# katago_server.py
from flask import Flask, request, jsonify
import subprocess
import json
import time
import sys
import threading
import atexit
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 允许所有来源

# ====== 配置路径（根据你的环境调整）======
KATAGO_CMD = "/gemini/code/katago/squashfs-root/AppRun"
CONFIG_FILE = "/gemini/code/katago/analysis.cfg"
MODEL_FILE = "/gemini/code/katago/models/kata1-b28c512nbt-s12133626112-d5640204584.bin.gz"
# =========================================

# 全局变量：KataGo 进程对象和线程锁
katago_proc = None
katago_lock = threading.Lock()

def start_katago():
    """在后台启动常驻的 KataGo 进程"""
    global katago_proc
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 🚀 Starting KataGo process...", file=sys.stderr)
    katago_proc = subprocess.Popen(
        [KATAGO_CMD, "analysis", "-config", CONFIG_FILE, "-model", MODEL_FILE],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,  # 错误信息可以输出到日志
        text=True,
        bufsize=1  # 行缓冲
    )
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] ✅ KataGo is ready.", file=sys.stderr)

def stop_katago():
    """在 Flask 关闭时安全释放 KataGo"""
    global katago_proc
    if katago_proc:
        print("Shutting down KataGo...", file=sys.stderr)
        katago_proc.terminate()
        katago_proc.wait()

# 注册退出钩子
atexit.register(stop_katago)

@app.before_request
def log_request():
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] ← {request.remote_addr} {request.method} {request.path}", file=sys.stderr)
    if request.is_json:
        json_data = request.get_json()
        if json_data:
            json_str = json.dumps(json_data, ensure_ascii=False, indent=2)
            print("  JSON:", json_str[:500], file=sys.stderr)
        else:
            print("  JSON: None", file=sys.stderr)

def xy_to_gtp(x, y, board_size=19):
    if not (0 <= x < board_size and 0 <= y < board_size):
        return None
    cols = "ABCDEFGHJKLMNOPQRST"
    col = cols[x]
    row = str(board_size - y)
    return col + row

def is_valid_json_line(line):
    line = line.strip()
    if not line.startswith('{'):
        return False
    try:
        obj = json.loads(line)
        return isinstance(obj.get("id"), str)
    except:
        return False

@app.route("/analyze", methods=["POST"])
def analyze():
    global katago_proc
    try:
        data = request.json
        if not data or "board_state" not in data:
            return jsonify({"error": "Missing 'board_state'"}), 400

        board_state = data["board_state"]
        size = board_state.get("size", 19)
        black_list = board_state.get("stones", {}).get("black", [])
        white_list = board_state.get("stones", {}).get("white", [])

        initial_stones = []
        for pt in black_list:
            if len(pt) == 2:
                gtp = xy_to_gtp(pt[0], pt[1], size)
                if gtp: initial_stones.append(["B", gtp])
        for pt in white_list:
            if len(pt) == 2:
                gtp = xy_to_gtp(pt[0], pt[1], size)
                if gtp: initial_stones.append(["W", gtp])

        request_id = f"req_{int(time.time() * 1000)}"
        '''katago_request = {
            "id": request_id,
            "initialStones": initial_stones,
            "moves": [],
            "rules": "chinese",
            "komi": 7.5,
            "boardXSize": size,
            "boardYSize": size,
            "maxVisits": 500
        }'''
        # 接收 history
        moves_history = board_state.get("history", [])
        
        katago_request = {
            "id": request_id,
            "initialStones": [], # 除非是研究让子棋，否则这里保持为空
            "moves": moves_history, # 把历史轨迹传给 AI
            "rules": "chinese",
            "komi": 7.5,
            "boardXSize": size,
            "boardYSize": size,
            "maxVisits": 500
        }

        katago_output = None

        # 使用线程锁，确保同一时间只有一个请求在读写管道
        with katago_lock:
            # 发送请求
            katago_proc.stdin.write(json.dumps(katago_request) + "\n")
            katago_proc.stdin.flush()

            # 循环读取输出，直到找到匹配当前 request_id 的 JSON 行
            while True:
                line = katago_proc.stdout.readline()
                if not line:
                    break
                if is_valid_json_line(line):
                    obj = json.loads(line)
                    if obj.get("id") == request_id:
                        katago_output = obj
                        break
        
        if not katago_output:
            return jsonify({"error": "No valid KataGo response found"}), 500

        return jsonify({
            "task": "explain_recommended_move",
            "board_state": board_state,
            "katago_output": katago_output,
            "structured_situation": data.get("structured_situation", {}),
            "rag_context": data.get("rag_context", {})
        })

    except Exception as e:
        print("Server error:", str(e))
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

if __name__ == "__main__":
    # 在启动 Flask 之前先启动 KataGo
    start_katago()
    print(f"🚀 Starting KataGo server on http://0.0.0.0:8080", file=sys.stderr)
    app.run(host="0.0.0.0", port=8080, debug=False, threaded=True)