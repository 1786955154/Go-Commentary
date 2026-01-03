# SIR系统 - 棋局分析与解释生成系统
import json
def identify_phase(move_number, katago_score_curve):
    """
    识别当前围棋对局所处的阶段
    
    参数:
    move_number (int): 当前棋局已经进行的步数
    katago_score_curve (list): KataGo提供的胜率变化曲线
    
    返回:
    str: 当前棋局阶段 ("opening", "midgame", "endgame")
    """
    # 步骤1: 基于步数的初步判断
    if move_number < 50:
        # 初步判断为开局
        phase = "opening"
    elif 50 <= move_number < 150:
        # 初步判断为中盘，需要进一步确认
        phase = "midgame"
    else:
        # 初步判断为官子
        phase = "endgame"
    
    # 步骤2: 基于胜率波动的精确判断（仅对中盘初步判断进行）
    if phase == "midgame":
        # 如果胜率曲线为空，无法判断，保持为中盘
        if not katago_score_curve:
            return phase
        
        # 计算胜率变化范围
        score_range = max(katago_score_curve) - min(katago_score_curve)
        
        # 如果胜率变化范围 > 0.3，则确认为中盘
        # 否则，视为开局
        if score_range > 0.3:
            phase = "midgame"
        else:
            phase = "opening"
    
    return phase

def calculate_territory_balance(katago_output):
    """
    计算地盘平衡分析
    
    参数:
    katago_output (dict): KataGo的输出数据，包含"ownership"字段
    
    返回:
    dict: 地盘平衡分析结果
    {
        "black": 黑方控制的地盘比例,
        "white": 白方控制的地盘比例,
        "balance": 地盘平衡差值
    }
    """
    # 提取黑方和白方的地盘控制数据
    black_ownership = {}
    white_ownership = {}
    
    for key, value in katago_output["ownership"].items():
        if key.startswith("B"):
            black_ownership[key] = value
        elif key.startswith("W"):
            white_ownership[key] = value
    
    # 计算双方总控制率
    black_total = sum(black_ownership.values())
    white_total = sum(white_ownership.values())
    
    # 计算总控制率
    total = black_total + white_total
    
    # 计算比例
    black_ratio = black_total / total
    white_ratio = white_total / total
    
    # 计算地盘平衡差值
    balance = abs(black_ratio - white_ratio)
    
    return {
        "black": black_ratio,
        "white": white_ratio,
        "balance": balance
    }

def identify_weak_groups(katago_output, liberty_threshold=2):
    """
    识别弱棋形/劣势群组
    
    参数:
    katago_output (dict): KataGo的输出数据，包含"groups"字段
    liberty_threshold (int): 气数阈值，用于判断弱棋形
    
    返回:
    list: 弱棋形列表，每个元素是包含以下信息的字典
    {
        "color": 棋子颜色 ("B"或"W"),
        "stones": 该棋群包含的棋子坐标列表,
        "liberties": 气数,
        "under_attack": 是否被攻击
    }
    """
    weak_groups = []
    
    # 遍历所有棋子分组
    for group in katago_output["groups"]:
        # 判断是否为弱棋形
        if group["liberties"] <= liberty_threshold or group["under_attack"]:
            weak_groups.append({
                "color": group["color"],
                "stones": group["stones"],
                "liberties": group["liberties"],
                "under_attack": group["under_attack"]
            })
    
    return weak_groups

def identify_candidate_intents(katago_output, weak_groups, tension_zones):
    """
    识别候选意图
    
    参数:
    katago_output (dict): KataGo的输出数据
    weak_groups (list): 弱棋形列表
    tension_zones (list): 紧张区域列表
    
    返回:
    list: 候选意图列表
    """
    candidate_intents = []
    
    # 条件1：攻击对手弱棋
    if weak_groups and any(g["color"] != katago_output["current_player"] for g in weak_groups):
        candidate_intents.append("attack weak group")
    
    # 条件2：防守己方弱棋
    if weak_groups and any(g["color"] == katago_output["current_player"] for g in weak_groups):
        candidate_intents.append("defend weak group")
    
    # 条件3：扩张势力
    territory_balance = calculate_territory_balance(katago_output)
    if katago_output["current_player"] == "B" and territory_balance["black"] < 0.4:
        candidate_intents.append("expand territory")
    
    # 条件4：压制对手影响力
    if tension_zones:
        candidate_intents.append("reduce opponent influence")
    
    return candidate_intents

def map_line_semantics(current_move_position):
    """
    线位语义映射
    
    参数:
    current_move_position (str or tuple): 当前落子坐标，如"10,10"或(10, 10)
    
    返回:
    dict: 线位语义映射结果
    {
        "current_move_line": 线位数值,
        "current_move_strategy": 战略含义
    }
    """
    # 提取线位（纵坐标）
    if isinstance(current_move_position, str):
        x, y = map(int, current_move_position.split(","))
    elif isinstance(current_move_position, tuple):
        x, y = current_move_position
    else:
        raise ValueError("Invalid move position format")
    
    # 根据线位判断战略高度
    if y == 1:
        strategy = "death line"
    elif y == 2:
        strategy = "territory line/failure line"
    elif y == 3:
        strategy = "real estate line"
    elif y == 4:
        strategy = "influence line/thickness line"
    else:  # y >= 5
        strategy = "high line/middle board"
    
    return {
        "current_move_line": str(y),
        "current_move_strategy": strategy
    }

def map_relative_geometric_semantics(tension_zones, candidate_intents):
    """
    相对几何语义映射
    
    参数:
    tension_zones (list): 紧张区域列表
    candidate_intents (list): 候选意图列表
    
    返回:
    dict: 相对几何语义映射结果
    {
        "tension_zones": 紧张区域列表（添加了相对几何信息）,
        "intents": 候选意图列表,
        "semantic_mapping": 战略语义映射
    }
    """
    # 计算紧张区域之间的相对几何关系
    # 初始化所有紧张区域的 relative_geometry 字段（避免 Key Error）
    for zone in tension_zones:
        zone["relative_geometry"] = "center"  # 为参考点设置默认值

    # 计算紧张区域之间的相对几何关系（仅处理非参考点）
    for zone in tension_zones:
        if tension_zones[0]["x"] != zone["x"] or tension_zones[0]["y"] != zone["y"]:
            dx = abs(tension_zones[0]["x"] - zone["x"])
            dy = abs(tension_zones[0]["y"] - zone["y"])
            distance = (dx**2 + dy**2)**0.5
            
            # 根据距离判断相对几何关系
            if distance < 3:
                zone["relative_geometry"] = "highly compact"
            elif 3 <= distance <= 5:
                zone["relative_geometry"] = "moderately compact"
            elif 5 < distance <= 7:
                zone["relative_geometry"] = "moderate distance"
            else:
                zone["relative_geometry"] = "long distance"
    # 结合候选意图生成战略语义映射
    semantic_mapping = ""
    
    # 优先处理攻击弱棋意图
    if "attack weak group" in candidate_intents:
        if any(zone["relative_geometry"] == "highly compact" for zone in tension_zones):
            semantic_mapping += "clamping attack"
        elif any(zone["relative_geometry"] == "moderately compact" for zone in tension_zones):
            semantic_mapping += "layout attack"
        else:
            semantic_mapping += "strategic attack"
    
    # 添加减少对手影响力意图
    if "reduce opponent influence" in candidate_intents:
        if "clamping attack" in semantic_mapping:
            semantic_mapping += " and balanced suppression"
        else:
            if any(zone["relative_geometry"] == "moderate distance" for zone in tension_zones):
                semantic_mapping += "balanced suppression"
            else:
                semantic_mapping += "global suppression"
    
    # 添加扩张地盘意图
    if "expand territory" in candidate_intents:
        if "clamping attack" in semantic_mapping:
            semantic_mapping += " and territory expansion"
        else:
            semantic_mapping += "territory expansion"
    
    # 如果没有匹配的意图，返回默认值
    if not semantic_mapping:
        semantic_mapping = "general strategic move"
    
    return {
        "tension_zones": tension_zones,
        "intents": candidate_intents,
        "semantic_mapping": semantic_mapping
    }

def generate_explanation(phase, territory_balance, weak_groups, candidate_intents, line_semantics, relative_geometry):
    # 阶段中文映射
    phase_zh = {
        "opening": "开局阶段",
        "midgame": "中盘阶段",
        "endgame": "官子阶段"
    }.get(phase, phase)
    # 线位战略含义中文映射
    line_strategy_zh = {
        "death line": "死亡线（一线）",
        "territory line/failure line": "实地线/失败线（二线）",
        "real estate line": "实地线（三线）",
        "influence line/thickness line": "势力线/厚势线（四线）",
        "high line/middle board": "高位线/中腹线（五线及以上）"
    }
    #几何关系语义中文映射
    geometry_zh = {
    "clamping attack": "夹击型进攻",
    "layout attack": "布局型进攻",
    "strategic attack": "战略性进攻",
    "balanced suppression": "均衡压制",
    "global suppression": "全局压制",
    "territory expansion": "实地扩张",
    "general strategic move": "通用战略着法"
   }
    # 意图中文映射
    intent_zh_map = {
        "attack weak group": "攻击对方弱棋",
        "defend weak group": "防守己方弱棋",
        "expand territory": "扩张地盘",
        "reduce opponent influence": "削弱对手影响力"
    }
    strategic_intents_zh = [intent_zh_map.get(i, i) for i in candidate_intents]

    return {
        "对局阶段": phase_zh,
        "地盘分析": {
            "黑方控制比例": round(territory_balance["black"], 3),
            "白方控制比例": round(territory_balance["white"], 3),
            "地盘差值": round(territory_balance["balance"], 3)
        },
        "弱棋群组": [
            {
                "颜色": "白方" if g["color"] == "W" else "黑方",
                "位置坐标": g["stones"],
                "气数": g["liberties"],
                "是否被攻击": g["under_attack"]
            } for g in weak_groups
        ],
        "战略意图": strategic_intents_zh,
        "落子分析": {
            "线位": f"第{line_semantics['current_move_line']}线",
            "战略含义": line_strategy_zh.get(line_semantics["current_move_strategy"], line_semantics["current_move_strategy"])
        },
        "几何关系解读": geometry_zh.get(relative_geometry.get("semantic_mapping", ""), "通用战略着法")
    }
def generate_sir_explanation(katago_output, move_number, katago_score_curve, current_move_position):
    """
    生成SIR系统的完整解释
    
    参数:
    katago_output (dict): KataGo的输出数据
    move_number (int): 当前棋局已经进行的步数
    katago_score_curve (list): KataGo的胜率变化曲线
    current_move_position (str or tuple): 当前落子坐标
    
    返回:
    str: 详细的解释
    """
    # 步骤1: 阶段识别
    phase = identify_phase(move_number, katago_score_curve)
    
    # 步骤2: 地盘平衡分析
    territory_balance = calculate_territory_balance(katago_output)
    
    # 步骤3: 弱棋形识别
    weak_groups = identify_weak_groups(katago_output)
    
    # 步骤4: 候选意图识别
    # 注意：这里我们暂时使用空列表作为紧张区域（实际应用中应从紧张区域识别模块获取）
    candidate_intents = identify_candidate_intents(katago_output, weak_groups, [])
    
    # 步骤5: 线位语义映射
    line_semantics = map_line_semantics(current_move_position)
    
    # 步骤6: 相对几何语义映射
    # 注意：这里我们使用一个简化版的紧张区域（实际应用中应从紧张区域识别模块获取）
    tension_zones = [{"x": 10, "y": 10, "intensity": 0.75, "group_id": "G1"}]
    relative_geometry = map_relative_geometric_semantics(tension_zones, candidate_intents)
    
    # 步骤7: 语义整合与解释生成
    explanation = generate_explanation(
        phase, 
        territory_balance, 
        weak_groups, 
        candidate_intents, 
        line_semantics, 
        relative_geometry
    )
    
    return explanation

if __name__ == "__main__":
    # 模拟KataGo的输出数据（已包含stones字段）
    katago_output = {
        "current_player": "B",
        "ownership": {
            "B1": 0.8, "B2": 0.7, "B3": 0.6, "B4": 0.5, "B5": 0.4,
            "W1": 0.2, "W2": 0.3, "W3": 0.4, "W4": 0.5, "W5": 0.6
        },
        "groups": [
            {"id": "G1", "color": "B", "liberties": 3, "under_attack": False, "stones": ["D1", "E1"]},
            {"id": "G2", "color": "W", "liberties": 1, "under_attack": True, "stones": ["D17", "E17"]},
            {"id": "G3", "color": "B", "liberties": 2, "under_attack": False, "stones": ["D16", "E16"]}
        ]
    }
    
    # 模拟当前局面
    move_number = 80
    katago_score_curve = [0.5, 0.55, 0.6, 0.58, 0.65, 0.55]
    current_move_position = "10,3"
    
    # 生成SIR解释


    explanation = generate_sir_explanation(
        katago_output, 
        move_number, 
        katago_score_curve, 
        current_move_position
    )

    print("SIR系统分析结果 (JSON格式):")
    print(json.dumps(explanation, indent=2, ensure_ascii=False))