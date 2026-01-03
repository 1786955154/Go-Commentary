/**
 * go.js
 * 说明: 棋盘交互与 AI 分析逻辑（从 go.html 分离）
 * 作者: （自动重构）
 * 创建: 2025-12-30
 * 约定: 使用 `init()` 作为入口，在 DOMContentLoaded 时调用
 */
'use strict';

function init() {
const boardSize = 19;
let boardState = {
    size: boardSize,
    to_play: 'black',
    move_number: 0,
    stones: { black: [], white: [] },
    movesHistory: [] // 用于悔棋，记录每一步及被提的棋子
};

// 初始化棋盘
const boardDiv = document.getElementById('board');
for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.addEventListener('click', () => placeStone(x, y));
        boardDiv.appendChild(cell);
    }
}
    // 将 SVG overlay 移入棋盘内部以便与格子 DOM 对齐（保证 overlay 在 cells 之上）
    const overlayEl = document.getElementById('boardOverlay');
    if (overlayEl && boardDiv) boardDiv.appendChild(overlayEl);
    const boardWrapper = document.getElementById('boardWrapper');

    // 创建并定位坐标标签（左侧数字、底部字母）
    function createCoordinateLabels() {
        const left = document.getElementById('coordLeft') || document.createElement('div');
        left.id = 'coordLeft';
        left.style.position = 'absolute';
        left.style.left = '-44px';
        left.style.top = '0';
        left.style.width = '40px';
        left.style.height = '100%';
        left.style.pointerEvents = 'none';
        if (!boardWrapper.contains(left)) boardWrapper.appendChild(left);

        const bottom = document.getElementById('coordBottom') || document.createElement('div');
        bottom.id = 'coordBottom';
        bottom.style.position = 'absolute';
        bottom.style.left = '0';
        bottom.style.top = '100%';
        bottom.style.height = '28px';
        bottom.style.width = '100%';
        bottom.style.pointerEvents = 'none';
        if (!boardWrapper.contains(bottom)) boardWrapper.appendChild(bottom);

        left.innerHTML = '';
        bottom.innerHTML = '';

        for (let y = 0; y < boardSize; y++) {
            const lbl = document.createElement('div');
            lbl.className = 'coord-left-label';
            lbl.textContent = (boardSize - y).toString();
            left.appendChild(lbl);
        }

        const cols = "ABCDEFGHJKLMNOPQRST";
        for (let x = 0; x < boardSize; x++) {
            const lbl = document.createElement('div');
            lbl.className = 'coord-bottom-label';
            lbl.textContent = cols[x];
            bottom.appendChild(lbl);
        }

        updateCoordinatesPositions();
    }

    function updateCoordinatesPositions() {
        const left = document.getElementById('coordLeft');
        const bottom = document.getElementById('coordBottom');
        if (!left || !bottom) return;
        const wrapperRect = boardWrapper.getBoundingClientRect();

        // 左侧：每一行的垂直居中位置
        for (let y = 0; y < boardSize; y++) {
            const cell = document.querySelector(`.cell[data-x='0'][data-y='${y}']`);
            const lbl = left.children[y];
            if (!cell || !lbl) continue;
            const crect = cell.getBoundingClientRect();
            const top = crect.top - wrapperRect.top + crect.height / 2;
            lbl.style.top = top + 'px';
        }

        // 底部：每一列的水平居中位置
        for (let x = 0; x < boardSize; x++) {
            const cell = document.querySelector(`.cell[data-x='${x}'][data-y='${boardSize-1}']`);
            const lbl = bottom.children[x];
            if (!cell || !lbl) continue;
            const crect = cell.getBoundingClientRect();
            const leftPos = crect.left - wrapperRect.left + crect.width / 2;
            lbl.style.left = leftPos + 'px';
        }
    }

    // 初次创建
    createCoordinateLabels();

    /**
     * 缓存常用 DOM 节点，便于维护与单元测试
     */
    function cacheDOM() {
        // 示例：可按需扩展
        // window.cached = window.cached || {};
        // window.cached.board = document.getElementById('board');
    }

    /**
     * 事件绑定集合（集中管理所有事件监听器）
     */
    function bindEvents() {
        // 保留原有按需绑定或在此统一管理
    }

    // 初始化绑定
    cacheDOM();
    bindEvents();

// 当前显示的 PV 对象（用于重绘）
let currentPVObjs = null;

function updateBoardCellSize() {
    const boardRect = boardDiv.getBoundingClientRect();
    const colGap = 1; // column-gap: 1px
    const rowGap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap')) || 1;
    
    // 总间隙 = (colGap + rowGap) * (n-1)
    const totalGap = (colGap + rowGap) * (boardSize - 1);
    const available = boardRect.width - totalGap;
    let cell = Math.floor(available / boardSize);
    if (cell < 8) cell = 8;
    
    // 重新设置 --cell-size
    document.documentElement.style.setProperty('--cell-size', cell + 'px');
}

function recomputeOverlayDebounced() {
    if (recomputeOverlayDebounced._t) clearTimeout(recomputeOverlayDebounced._t);
    recomputeOverlayDebounced._t = setTimeout(() => {
        updateBoardCellSize();
        if (typeof updateCoordinatesPositions === 'function') updateCoordinatesPositions();
        if (currentPVObjs) drawPVLines(currentPVObjs);
    }, 120);
}

window.addEventListener('resize', recomputeOverlayDebounced);
window.addEventListener('scroll', recomputeOverlayDebounced);
// 更新侧栏中间的行棋指示器，使其与 boardState.to_play 同步
function updateTurnIndicator() {
    const badge = document.getElementById('turnBadge');
    const c1 = document.getElementById('c1');
    const c2 = document.getElementById('c2');
    const c3 = document.getElementById('c3');
    const c4 = document.getElementById('c4');
    if (!badge || !c1 || !c2 || !c3 || !c4) return;
    if (boardState.to_play === 'black') {
        badge.style.borderColor = '#d9534f';
        c1.textContent = '黑';
        c2.textContent = '方';
        c3.textContent = '行';
        c4.textContent = '棋';
        c1.style.color = c2.style.color = c3.style.color = c4.style.color = '#d9534f';
    } else {
        badge.style.borderColor = '#007bff';
        c1.textContent = '白';
        c2.textContent = '方';
        c3.textContent = '行';
        c4.textContent = '棋';
        c1.style.color = c2.style.color = c3.style.color = c4.style.color = '#007bff';
    }
}
/**
 * 获取一个棋块的所有连通棋子（同色）
 * @param {Array<Array<?string>>} board 二维棋盘数组，null| 'B' | 'W'
 * @param {number} x 起始 x
 * @param {number} y 起始 y
 * @param {'B'|'W'} color 颜色
 * @returns {Array<[number,number]>} 连通棋子坐标数组
 */
// 获取一个棋块的所有连通棋子（同色）
function getGroup(board, x, y, color) {
    const visited = new Set();
    const group = [];
    const stack = [[x, y]];
    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (board[cy]?.[cx] !== color) continue;
        group.push([cx, cy]);
        // 上下左右
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                stack.push([nx, ny]);
            }
        }
    }
    return group;
}

// 计算一个棋块的“气”（空邻点）
function getLiberties(board, group) {
    const liberties = new Set();
    for (const [x, y] of group) {
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                if (board[ny][nx] === null) {
                    liberties.add(`${nx},${ny}`);
                }
            }
        }
    }
    return liberties.size;
}

/**
 * 将 GTP 坐标转换为 [x,y]
 * @param {string} gtp 如 "D16"
 * @param {number} size 棋盘尺寸
 * @returns {[number,number]|null}
 */

function placeStone(x, y) {
    // 用户选择落子时：移除所有推荐标识（立即隐藏推荐落点）
    document.querySelectorAll('.hint').forEach(el => el.remove());
    // 构建当前 board 状态（二维数组）
    const board = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));
    for (const [bx, by] of boardState.stones.black) board[by][bx] = 'B';
    for (const [wx, wy] of boardState.stones.white) board[wy][wx] = 'W';

    const color = boardState.to_play === 'black' ? 'B' : 'W';
    const opponent = color === 'B' ? 'W' : 'B';

    // 1. 检查是否已有子
    if (board[y][x] !== null) return;

    // 2. 临时下子
    board[y][x] = color;

    // 3. 检查是否提掉对方棋子
    let captured = [];
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize && board[ny][nx] === opponent) {
            const group = getGroup(board, nx, ny, opponent);
            if (getLiberties(board, group) === 0) {
                captured.push(...group);
            }
        }
    }

    // 记录历史（放在应用提子之前，保存被提的位置和颜色）
    const placedColorName = (color === 'B') ? 'black' : 'white';
    const opponentName = (opponent === 'B') ? 'black' : 'white';
    const historyEntry = {
        x, y,
        color: placedColorName,
        captured: captured.map(([cx, cy]) => ({ x: cx, y: cy, color: opponentName }))
    };

    // 4. 如果没提子，检查自己是否无气（自杀）
    if (captured.length === 0) {
        const selfGroup = getGroup(board, x, y, color);
        if (getLiberties(board, selfGroup) === 0) {
            alert("不能自杀！");
            return;
        }
    }

    // 5. 应用提子
    for (const [cx, cy] of captured) {
        board[cy][cx] = null;
        // 从 stones 中移除
        boardState.stones[opponent === 'B' ? 'black' : 'white'] = 
            boardState.stones[opponent === 'B' ? 'black' : 'white'].filter(
                ([sx, sy]) => sx !== cx || sy !== cy
            );
        // 清除 DOM
        document.querySelector(`.cell[data-x='${cx}'][data-y='${cy}']`).innerHTML = '';
    }

    // 6. 添加新子
    boardState.stones[boardState.to_play].push([x, y]);
    // 将历史压入 movesHistory（代表这一步已成功落子）
    boardState.movesHistory.push(historyEntry);
    boardState.move_number++;
    boardState.to_play = boardState.to_play === 'black' ? 'white' : 'black';

    // 7. 更新 DOM
    const cell = document.querySelector(`.cell[data-x='${x}'][data-y='${y}']`);
    const stone = document.createElement('div');
    stone.className = boardState.to_play === 'white' ? 'black' : 'white'; // 注意：刚下的子颜色是之前的
    // 更正：应该根据实际颜色
    stone.className = (color === 'B') ? 'black' : 'white';
    cell.appendChild(stone);
    // 每次用户成功落子后，清除任何剩余的 PV 显示（标记/连线/侧栏）
    try {
        clearPVMarks();
        clearPVLines();
        const pvDisplay = document.getElementById('pvDisplay');
        if (pvDisplay) pvDisplay.innerHTML = '';
        currentPVObjs = null;
    } catch (e) { console.error('清除 PV 时出错', e); }
    // 同步更新侧栏行棋提示
    updateTurnIndicator();
    // 告知计时器：已正常落子，切换到下一位并重启计时
    if (typeof onMoveMade === 'function') onMoveMade();
    const isAuto = document.getElementById('autoAnalyzeToggle').checked;
    if (isAuto) {
        triggerAnalysis();
    }
}

/**
 * 将 [x,y] 转换为 GTP 坐标（例如 [3,3] -> D16）
 * @param {number} x
 * @param {number} y
 * @param {number} [size=19]
 * @returns {string|null}
 */

// GTP 坐标转 [x, y]
function gtpToXY(gtp, size = 19) {
    if (!gtp || gtp.length < 2) return null;
    const colIndex = "ABCDEFGHJKLMNOPQRST".indexOf(gtp[0].toUpperCase());
    const rowNumber = parseInt(gtp.slice(1), 10);
    if (colIndex === -1 || isNaN(rowNumber)) return null;
    const y = size - rowNumber;
    return (y >= 0 && y < size) ? [colIndex, y] : null;
}
/**
 * 可视化 KataGo 原生输出（将结果映射到 UI）
 * @param {object} katagoOutput
 */
// 新增：[x, y] 坐标转 GTP (例如 [3, 3] -> "D16")
function xyToGTP(x, y, size = 19) {
    const cols = "ABCDEFGHJKLMNOPQRST";
    if (x < 0 || x >= size) return null;
    const col = cols[x];
    const row = size - y;
    return col + row;
}
// 可视化 KataGo 原生输出
function visualizeKatagoOutput(katagoOutput) {
    
    // 1. 清除旧的 hint 和 PV
    document.querySelectorAll('.hint').forEach(el => el.remove());
    
    // 2. 彻底重置所有格子的悬停状态
    document.querySelectorAll('.cell').forEach(cell => {
        if (cell._pvHoverBound) {
            // 通过克隆节点来简单粗暴地清除所有匿名函数的 mouseenter/mouseleave 绑定
            const newCell = cell.cloneNode(true);
            cell.parentNode.replaceChild(newCell, cell);
            
            // 必须重新补上点击落子的监听器
            const cx = parseInt(newCell.dataset.x);
            const cy = parseInt(newCell.dataset.y);
            newCell.addEventListener('click', () => placeStone(cx, cy));
            
            delete newCell._pvHoverBound;
        }
    });
    // 打印并展示后端返回的完整结构，便于确认字段名和调试
    console.log('⤴️ katagoOutput (raw):', katagoOutput);
    try {
        const pre = document.getElementById('katagoRaw');
        if (pre) pre.textContent = JSON.stringify(katagoOutput, null, 2);
    } catch (e) {
        console.error('无法渲染 katagoOutput JSON:', e);
    }
    document.querySelectorAll('.hint').forEach(el => el.remove());
/*
    // 全局胜率（rootInfo.winrate 是当前执子方胜率）并在侧栏展示更多 rootInfo 字段
    const evalDiv = document.getElementById('evaluation');
    const rootInfo = katagoOutput.rootInfo || {};
    const winrate = rootInfo.winrate ?? 0.5;
    // 注意：如果当前轮到白下，winrate 是白方胜率；但我们统一显示“黑方胜率”
    const totalMoves = (boardState.stones.black.length + boardState.stones.white.length);
    const isBlackToPlay = (totalMoves % 2 === 0);
    const blackWinrate = isBlackToPlay ? winrate : (1 - winrate);
    evalDiv.textContent = `全局评估：黑方胜率 ${(blackWinrate * 100).toFixed(1)}%`;
*/
        // 1. 获取 rootInfo
    const rootInfo = katagoOutput.rootInfo || {};
    const winrate = rootInfo.winrate ?? 0.5;

    // 2. 直接从 AI 返回的结果中获取“当前是谁在下”
    // KataGo 返回的 rootInfo.currentPlayer 是 'B' 或 'W'
    const currentPlayer = rootInfo.currentPlayer; 

    // 3. 转换胜率：如果当前是黑下，胜率就是黑的；如果当前是白下，黑胜率 = 1 - 白胜率
    const blackWinrate = (currentPlayer === 'B') ? winrate : (1 - winrate);
    const whiteWinrate = (currentPlayer === 'W') ? winrate : (1 - winrate);

    // 4. 获取领跑目数（Score Lead）
    // scoreLead 正数通常代表当前玩家领先，负数代表落后
    // 我们也统一转换成“黑棋领先目数”
    const scoreLead = rootInfo.scoreLead || 0;
    const blackScoreLead = (currentPlayer === 'B') ? scoreLead : -scoreLead;

    // 5. 更新侧边栏展示
const evalDiv = document.getElementById('evaluation');

// 判断领先方
const blackWin = blackWinrate >= 0.5;
const whiteWin = !blackWin;

// 颜色：领先方用红色，落后方用灰色
const blackColor = blackWin ? '#d9534f' : '#666';
const whiteColor = whiteWin ? '#d9534f' : '#666';

// 构造目差文本
const leadText = `${blackScoreLead > 0 ? '黑领先' : '白领先'} ${Math.abs(blackScoreLead).toFixed(1)}目`;

evalDiv.innerHTML = `
    <!-- 标题行：左侧“全局评估”，右侧“领先X目” -->
    <div style="font-size: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">
        <span>全局评估 (第 ${katagoOutput.turnNumber} 手)</span>
        <span style="color: #d9534f; font-weight: bold;">${leadText}</span>
    </div>
    
    <!-- 黑方胜率：文字和数字挨在一起 -->
    <div style="margin-bottom: 6px;">
        <span style="font-size: 13px; color: #666;">黑方胜率：</span>
        <span style="font-size: 13px; font-weight: bold; color: ${blackColor}">
            ${(blackWinrate * 100).toFixed(1)}%
        </span>
    </div>

    <!-- 胜率进度条 -->
    <div style="width: 100%; height: 10px; background: #eee; border-radius: 5px; overflow: hidden; display: flex; margin-bottom: 8px; border: 1px solid #ddd;">
        <div style="width: ${blackWinrate * 100}%; background: #d9534f; transition: width 0.5s ease;"></div>
        <div style="width: ${(1 - blackWinrate) * 100}%; background: #007bff; transition: width 0.5s ease;"></div>
    </div>

    <!-- 白方胜率：放在进度条下方右侧，右对齐 -->
    <div style="text-align: right; font-size: 13px; color: #666;">
        <span>白方胜率：</span>
        <span style="color: ${whiteColor}; font-weight: ${whiteWin ? 'bold' : 'normal'};">
            ${((1 - blackWinrate) * 100).toFixed(1)}%
        </span>
    </div>
`;
    // 在侧栏显示根节点的常用字段（可根据后端实际返回字段增删）
    /*
    const rootDiv = document.getElementById('rootInfo');
    if (rootDiv) {
        rootDiv.innerHTML = '';
        const makeRow = (k, v) => `<div><strong>${k}:</strong> ${v ?? '-'} </div>`;
        rootDiv.innerHTML += makeRow('winrate', (rootInfo.winrate ?? '-'));
        rootDiv.innerHTML += makeRow('scoreLead', (rootInfo.scoreLead ?? '-'));
        rootDiv.innerHTML += makeRow('scoreLeadStdev', (rootInfo.scoreLeadStdev ?? '-'));
        rootDiv.innerHTML += makeRow('visits', (rootInfo.visits ?? '-'));
        rootDiv.innerHTML += makeRow('analysisPV', (rootInfo.analysisPV ? JSON.stringify(rootInfo.analysisPV).slice(0,200) : '-'));
    }
    */

    // 推荐落点（moveInfos）——在侧栏显示详情，并在棋盘上可视化 visits 与 policy
    const topMoves = katagoOutput.moveInfos || [];
    const moveList = document.getElementById('moveList');
    if (moveList) moveList.innerHTML = '';
    // 计算 maxVisits 以归一化外环宽度
    const maxVisits = topMoves.reduce((m, mv) => Math.max(m, mv.visits ?? 0), 0) || 1;
    //topMoves.slice(0, 10).forEach((move, idx) =>
    topMoves.slice(0, 5).forEach((move, idx) => {
        const pos = gtpToXY(move.move, boardSize);
        if (!pos) return;
        const [x, y] = pos;
        const cell = document.querySelector(`.cell[data-x='${x}'][data-y='${y}']`);
        if (!cell || cell.querySelector('.black,.white')) return; // 已有子不画

        const visits = move.visits ?? 0;
        const policy = move.policy ?? move.prior ?? 0; // 不同后端字段兼容
        const mvWinrate = move.winrate ?? '-';
        const scoreLead = move.scoreLead ?? '-';

        // 在侧栏添加条目
        /*if (moveList) {
            const li = document.createElement('li');
            li.className = 'move-item';
            li.innerHTML = `<div><strong>${idx+1}. ${move.move}</strong><div class="move-stats">policy:${(policy).toFixed? (policy).toFixed(3) : policy} visits:${visits} winrate:${mvWinrate} scoreLead:${scoreLead}</div></div>`;
            // bind click: highlight board cell + show PV
            li.addEventListener('click', () => {
                clearHighlights();
                highlightCell(x, y);
            });
            moveList.appendChild(li);
        }*/

        // 在棋盘添加 hint 并根据 visits/policy 调整样式
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.textContent = idx + 1;
        // border width proportional to visits
        const borderW = 1 + (visits / maxVisits) * 4; // 1px .. 5px
        const alpha = Math.min(0.95, 0.18 + (policy * 0.8));
        hint.style.border = `${borderW}px dashed rgba(255,165,0,0.95)`;
        hint.style.background = `rgba(255,165,0,${alpha})`;
        cell.appendChild(hint);
        // 绑定悬停事件：鼠标移到候选点时显示 PV，移开则隐藏
        if (!cell._pvHoverBound) {
            const _enter = () => {
                clearHighlights();
                highlightCell(x, y, false); // 悬停时不滚动页面
                showPVForMove(move);
            };
            const _leave = () => {
                clearHighlights();
                clearPVLines();
                clearPVMarks();
            };
            cell.addEventListener('mouseenter', _enter);
            cell.addEventListener('mouseleave', _leave);
            cell._pvHoverBound = true;
        }
    });
    // helper: clear any previous PV marks/highlights
    function clearHighlights() {
        document.querySelectorAll('.cell.highlight').forEach(c => c.classList.remove('highlight'));
        clearPVMarks();
    }

    function clearPVMarks() {
        document.querySelectorAll('.pv-mark').forEach(m => m.remove());
    }

    function highlightCell(x, y, doScroll = true) {
        const c = document.querySelector(`.cell[data-x='${x}'][data-y='${y}']`);
        if (!c) return;
        c.classList.add('highlight');
        if (doScroll) {
            try { c.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch (e) {}
        }
    }

    function getPVFromMove(move) {
        // try several common field names
        if (!move) return [];
        if (Array.isArray(move.pv)) return move.pv;
        if (Array.isArray(move.analysisPV)) return move.analysisPV;
        if (Array.isArray(move.variation)) return move.variation;
        if (Array.isArray(move.sequence)) return move.sequence;
        // sometimes PV stored as string like "D4 E5 F6"
        const alt = move.pv || move.analysisPV || move.variation || move.sequence || move.bestSequence || null;
        if (typeof alt === 'string') return alt.trim().split(/\s+/);
        return [];
    }

    function showPVForMove(move) {
        clearPVMarks();
        const pvRaw = getPVFromMove(move);
        const pv = pvRaw.map(p => {
            if (!p) return null;
            if (typeof p === 'string') return { move: p };
            // object form
            const m = p.move || p.gtp || p[0] || p["gtp"] || null;
            return { move: m, winrate: p.winrate ?? p.winnerRate ?? p.wr ?? null, scoreLead: p.scoreLead ?? p.lead ?? null };
        }).filter(Boolean);
        const pvDisplay = document.getElementById('pvDisplay');
        if (pvDisplay) pvDisplay.innerHTML = '';
        if (!pv || pv.length === 0) {
            if (pvDisplay) pvDisplay.textContent = '无 PV 信息';
            clearPVLines();
            return;
        }

        // 不再绘制 PV 之间的连线（用户要求移除连线，仅保留序号标记）

        // render PV marks on board and clickable list with details
        const ol = document.createElement('ol');
        ol.style.margin = 0;
        ol.style.paddingLeft = '18px';
        pv.forEach((p, i) => {
            const gtp = p.move;
            const pos = gtpToXY(gtp, boardSize);
            if (pos) {
                const [mx, my] = pos;
                const cell = document.querySelector(`.cell[data-x='${mx}'][data-y='${my}']`);
                if (cell) {
                    const mark = document.createElement('div');
                    // class controls size, color and border
                    const moveColor = (i % 2 === 0) ? boardState.to_play : (boardState.to_play === 'black' ? 'white' : 'black');
                    mark.className = 'pv-mark ' + (moveColor === 'black' ? 'black' : 'white');
                    mark.textContent = (i+1).toString();
                    cell.appendChild(mark);
                }
            }
            const item = document.createElement('li');
            item.style.cursor = 'pointer';
            item.innerHTML = `<span>${i+1}. ${gtp}</span> <span style="color:#666;margin-left:8px;font-size:12px">${p.winrate? ('wr:'+p.winrate) : ''} ${p.scoreLead? ('lead:'+p.scoreLead) : ''}</span>`;
            item.addEventListener('click', () => {
                const pos = gtpToXY(gtp, boardSize);
                if (!pos) return;
                clearHighlights();
                highlightCell(pos[0], pos[1]);
            });
            ol.appendChild(item);
        });
        if (pvDisplay) pvDisplay.appendChild(ol);
    }

    function clearPVLines() {
        const svg = document.getElementById('boardOverlay');
        if (!svg) return;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    function drawPVLines(pvObjs) {
        clearPVLines();
        if (!pvObjs || pvObjs.length < 2) return;
        const svg = document.getElementById('boardOverlay');
        if (!svg) return;
        const boardEl = document.getElementById('board');
        const rect = boardEl.getBoundingClientRect();
        // set svg viewBox to pixel dimensions for easy placement and ensure pixel-aligned sizing
        svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

        const ns = (name => document.createElementNS('http://www.w3.org/2000/svg', name));
        // defs: reusable marker templates, shadow filter, etc.
        const defs = ns('defs');
        // drop shadow filter
        const filt = ns('filter');
        filt.setAttribute('id', 'pv-drop');
        filt.setAttribute('x', '-50%');
        filt.setAttribute('y', '-50%');
        filt.setAttribute('width', '200%');
        filt.setAttribute('height', '200%');
        const fe = ns('feDropShadow');
        fe.setAttribute('dx', '0');
        fe.setAttribute('dy', '1');
        fe.setAttribute('stdDeviation', '1');
        fe.setAttribute('flood-color', '#000');
        fe.setAttribute('flood-opacity', '0.2');
        filt.appendChild(fe);
        defs.appendChild(filt);

        // marker templates (black / white) larger and with shadow
        const makeMarker = (id, fill, stroke) => {
            const m = ns('marker');
            m.setAttribute('id', id);
            m.setAttribute('markerWidth', '12');
            m.setAttribute('markerHeight', '12');
            m.setAttribute('refX', '9');
            m.setAttribute('refY', '6');
            m.setAttribute('orient', 'auto');
            const p = ns('path');
            p.setAttribute('d', 'M 0 0 L 9 6 L 0 12 z');
            p.setAttribute('fill', fill);
            if (stroke) p.setAttribute('stroke', stroke);
            p.setAttribute('filter', 'url(#pv-drop)');
            m.appendChild(p);
            defs.appendChild(m);
        };
        makeMarker('pv-arrow-marker-black', '#000', null);
        makeMarker('pv-arrow-marker-white', '#fff', '#333');
        svg.appendChild(defs);

        // helper to compute cubic bezier control points
        function computeControls(ax, ay, bx, by, curvature=0.25) {
            const dx = bx - ax;
            const dy = by - ay;
            const mx = (ax + bx) / 2;
            const my = (ay + by) / 2;
            const len = Math.hypot(dx, dy) || 1;
            // normal vector
            const nx = -dy / len;
            const ny = dx / len;
            const cur = Math.min( Math.max(len * curvature, 10), 120 );
            // control points placed along the line with offset by normal vector
            const c1x = ax + dx * 0.3 + nx * cur;
            const c1y = ay + dy * 0.3 + ny * cur;
            const c2x = ax + dx * 0.7 + nx * cur;
            const c2y = ay + dy * 0.7 + ny * cur;
            return [c1x, c1y, c2x, c2y];
        }

        // cubic point evaluation at t
        function cubicPoint(t, p0, p1, p2, p3) {
            const u = 1 - t;
            const tt = t*t;
            const uu = u*u;
            const uuu = uu * u;
            const ttt = tt * t;
            const x = uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0];
            const y = uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1];
            return [x, y];
        }

        const sideToPlay = boardState.to_play;
        const oppositeSide = sideToPlay === 'black' ? 'white' : 'black';

        // prepare two arrow markers (black / white)
        const markerBlack = ns('marker');
        markerBlack.setAttribute('id', 'pv-arrow-marker-black');
        markerBlack.setAttribute('markerWidth', '8');
        markerBlack.setAttribute('markerHeight', '8');
        markerBlack.setAttribute('refX', '6');
        markerBlack.setAttribute('refY', '3');
        markerBlack.setAttribute('orient', 'auto');
        const arrowBlack = ns('path');
        arrowBlack.setAttribute('d', 'M 0 0 L 6 3 L 0 6 z');
        arrowBlack.setAttribute('fill', '#000');
        markerBlack.appendChild(arrowBlack);
        defs.appendChild(markerBlack);

        const markerWhite = ns('marker');
        markerWhite.setAttribute('id', 'pv-arrow-marker-white');
        markerWhite.setAttribute('markerWidth', '8');
        markerWhite.setAttribute('markerHeight', '8');
        markerWhite.setAttribute('refX', '6');
        markerWhite.setAttribute('refY', '3');
        markerWhite.setAttribute('orient', 'auto');
        const arrowWhite = ns('path');
        arrowWhite.setAttribute('d', 'M 0 0 L 6 3 L 0 6 z');
        arrowWhite.setAttribute('fill', '#fff');
        arrowWhite.setAttribute('stroke', '#333');
        markerWhite.appendChild(arrowWhite);
        defs.appendChild(markerWhite);

        for (let i = 0; i < pvObjs.length - 1; i++) {
            const aObj = pvObjs[i];
            const bObj = pvObjs[i+1];
            const a = gtpToXY(aObj.move, boardSize);
            const b = gtpToXY(bObj.move, boardSize);
            if (!a || !b) continue;
            // compute center coordinates from actual cell DOM positions to avoid alignment issues under zoom
            const cellA = document.querySelector(`.cell[data-x='${a[0]}'][data-y='${a[1]}']`);
            const cellB = document.querySelector(`.cell[data-x='${b[0]}'][data-y='${b[1]}']`);
            if (!cellA || !cellB) continue;
            const aRect = cellA.getBoundingClientRect();
            const bRect = cellB.getBoundingClientRect();
            const cx = aRect.left - rect.left + aRect.width / 2;
            const cy = aRect.top - rect.top + aRect.height / 2;
            const dx = bRect.left - rect.left + bRect.width / 2;
            const dy = bRect.top - rect.top + bRect.height / 2;
            // compute destination point adjusted to stone perimeter so arrow tip sits on circle edge
            const dx_total = dx, dy_total = dy;
            const vecX = dx_total - cx;
            const vecY = dy_total - cy;
            const vecLen = Math.hypot(vecX, vecY) || 1;
            const ux = vecX / vecLen;
            const uy = vecY / vecLen;
            // approximate stone radius: 90% of cell size / 2
            const stoneRadius = Math.min(bRect.width, bRect.height) * 0.9 / 2;
            const ex = dx_total - ux * stoneRadius;
            const ey = dy_total - uy * stoneRadius;
            const [c1x, c1y, c2x, c2y] = computeControls(cx, cy, ex, ey, 0.28);
            const d = `M ${cx} ${cy} C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`;

            // create gradient from source color -> dest color
            const gradId = `g-${i}-${Date.now()}`;
            const grad = ns('linearGradient');
            grad.setAttribute('id', gradId);
            grad.setAttribute('gradientUnits', 'userSpaceOnUse');
            grad.setAttribute('x1', cx);
            grad.setAttribute('y1', cy);
            grad.setAttribute('x2', ex);
            grad.setAttribute('y2', ey);
            // determine side colors
            const srcSide = (i % 2 === 0) ? boardState.to_play : (boardState.to_play === 'black' ? 'white' : 'black');
            const dstSide = ((i+1) % 2 === 0) ? boardState.to_play : (boardState.to_play === 'black' ? 'white' : 'black');
            const colorFor = s => s === 'black' ? '#000' : '#9ecfff';
            const stop1 = ns('stop'); stop1.setAttribute('offset','0%'); stop1.setAttribute('stop-color', colorFor(srcSide));
            const stop2 = ns('stop'); stop2.setAttribute('offset','100%'); stop2.setAttribute('stop-color', colorFor(dstSide));
            grad.appendChild(stop1); grad.appendChild(stop2);
            defs.appendChild(grad);

            // shadow path (thicker, blurred) for better contrast
            const shadow = ns('path');
            shadow.setAttribute('d', d);
            shadow.setAttribute('stroke', 'rgba(0,0,0,0.12)');
            shadow.setAttribute('stroke-width', '3');
            shadow.setAttribute('fill', 'none');
            shadow.setAttribute('filter', 'url(#pv-drop)');
            svg.appendChild(shadow);

            const path = ns('path');
            path.setAttribute('d', d);
            path.setAttribute('stroke', `url(#${gradId})`);
            path.setAttribute('stroke-width', '1.2');
            path.setAttribute('fill', 'none');
            // choose arrow marker by dest side
            if (dstSide === 'black') path.setAttribute('marker-end', 'url(#pv-arrow-marker-black)');
            else path.setAttribute('marker-end', 'url(#pv-arrow-marker-white)');
            svg.appendChild(path);

            // midpoint for label (t=0.5)
            const mid = cubicPoint(0.5, [cx, cy], [c1x, c1y], [c2x, c2y], [ex, ey]);
            const labelGroup = ns('g');
            const txt = ns('text');
            const label = (bObj.winrate !== undefined && bObj.winrate !== null) ? (`${(bObj.winrate*100).toFixed(1)}%`) : (bObj.scoreLead !== undefined ? (`${bObj.scoreLead}`) : '');
            txt.setAttribute('x', mid[0]);
            txt.setAttribute('y', mid[1]);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'central');
            txt.setAttribute('font-size', '10');
            txt.setAttribute('fill', '#003366');
            txt.textContent = label;
            // no background rectangle — keep label text only per UI request
            labelGroup.appendChild(txt);
            svg.appendChild(labelGroup);
        }
    }
}

// 悔棋：恢复上一步（包含被提子）
function undoMove() {
    if (!boardState.movesHistory || boardState.movesHistory.length === 0) return;
    const last = boardState.movesHistory.pop();
    const { x, y, color, captured } = last;

    // 从状态中移除该子
    boardState.stones[color] = boardState.stones[color].filter(([sx, sy]) => !(sx === x && sy === y));
    // 从 DOM 移除该子
    const cell = document.querySelector(`.cell[data-x='${x}'][data-y='${y}']`);
    if (cell) {
        const stone = cell.querySelector('.black,.white');
        if (stone) stone.remove();
    }

    // 恢复被提的棋子到状态与 DOM
    for (const cap of captured) {
        boardState.stones[cap.color].push([cap.x, cap.y]);
        const capCell = document.querySelector(`.cell[data-x='${cap.x}'][data-y='${cap.y}']`);
        if (capCell && !capCell.querySelector('.black,.white')) {
            const s = document.createElement('div');
            s.className = cap.color;
            capCell.appendChild(s);
        }
    }

    boardState.move_number = Math.max(0, boardState.move_number - 1);
    boardState.to_play = boardState.to_play === 'black' ? 'white' : 'black';
    // 更新侧栏行棋提示
    updateTurnIndicator();
    const isAuto = document.getElementById('autoAnalyzeToggle').checked;
    if (isAuto) {
        triggerAnalysis();
    } else {
        // 如果关闭了自动分析，悔棋后应该清除上一手的分析残留
        document.querySelectorAll('.hint').forEach(el => el.remove());
        clearPVMarks();
        clearPVLines();
    }
    // 如果计时被启用，悔棋后为当前执子方启动计时
    if (timerEnabled) startTimer();
}

document.getElementById('undoBtn').addEventListener('click', () => {
    undoMove();
});
// 开始/停止计时按钮（首次点击启动计时，再次点击停止）
document.getElementById('toggleTimerBtn').addEventListener('click', function() {
    const btn = this;
    if (!timerEnabled) {
        // 启动计时
        timerEnabled = true;
        btn.textContent = '停止计时';
        btn.style.background = '#dc3545';
        // 立即开始当前执子方的计时
        startTimer();
    } else {
        // 停止计时
        timerEnabled = false;
        btn.textContent = '开始计时';
        btn.style.background = '#007bff';
        stopTimer();
    }
});


// ====== 配置 DashScope Agent ======
const agentConfig = {
    appId: 'b0a92ead844a47b5a02c2a6fc199f772', 
    apiKey: 'sk-3e41cb3371e146fc9154489be58b9d6c'
};

// 1. 将 KataGo 的 JSON 数据转化为 Agent 易读的 Prompt
// 修改后的 buildAgentPrompt 函数
function buildAgentPrompt(katagoOutput, boardState) {
    const root = katagoOutput.rootInfo || {};
    const moveInfos = katagoOutput.moveInfos || [];
    
    // 1. 构造坐标转换工具（内部使用）
    const toGtp = (x, y) => xyToGTP(x, y, boardSize);

    /*/ 2. 统计当前棋盘上所有棋子的精确位置（帮助 Agent “看见”局面）
    const blackStones = boardState.stones.black.map(s => toGtp(s.x, s.y)).join(' ');
    const whiteStones = boardState.stones.white.map(s => toGtp(s.x, s.y)).join(' ');
   */
   // 2. 修正后的棋子提取逻辑
    // 增加对属性存在性的检查，确保 x 和 y 是数字
    const blackStones = (boardState.stones.black || [])
        .filter(s => typeof s.x === 'number' && typeof s.y === 'number')
        .map(s => toGtp(s.x, s.y))
        .join(' ');

    const whiteStones = (boardState.stones.white || [])
        .filter(s => typeof s.x === 'number' && typeof s.y === 'number')
        .map(s => toGtp(s.x, s.y))
        .join(' ');
    // 3. 构造完整的对局历史流
    const historyFlow = boardState.movesHistory
        .map((m, i) => `${i + 1}${m.color === 'black' ? 'B' : 'W'}[${toGtp(m.x, m.y)}]`)
        .join(' -> ');

    // 4. 计算当前视角的胜率
    const isBlackToPlay = (boardState.to_play === 'black');
    const sideName = isBlackToPlay ? '黑棋' : '白棋';
    const currentWR = root.winrate ?? 0.5;
    const blackWinrate = isBlackToPlay ? currentWR : (1 - currentWR);

    // 5. 构造高度结构化的 Prompt (采用标签化结构，便于 Agent 提取关键词进行 RAG 检索)
    let prompt = `【围棋局面分析请求】\n`;
    
    prompt += `<Current_Context>\n`;
    prompt += `- 手数: ${boardState.move_number}\n`;
    prompt += `- 轮到: ${sideName}\n`;
    prompt += `- 黑方胜率: ${(blackWinrate * 100).toFixed(1)}%\n`;
    prompt += `- 目数差: ${root.scoreLead?.toFixed(1) || 0} (正数黑优)\n`;
    prompt += `</Current_Context>\n\n`;

    prompt += `<Board_State>\n`;
    prompt += `- 完整对局进程: ${historyFlow || "开局"}\n`;
    prompt += `</Board_State>\n\n`;

    prompt += `<KataGo_Recommendations>\n`;
    moveInfos.slice(0, 3).forEach((m, i) => {
        const moveBlackWR = isBlackToPlay ? m.winrate : (1 - m.winrate);
        prompt += `- 候选${i + 1}: ${m.move}\n`;
        prompt += `  * 走后黑胜率: ${(moveBlackWR * 100).toFixed(1)}%\n`;
        prompt += `  * 预计变化图: ${Array.isArray(m.pv) ? m.pv.join(' -> ') : m.pv}\n`;
    });
    prompt += `</KataGo_Recommendations>\n`;

    return prompt;
}

// 2. 调用 Agent 接口
async function fetchAIAgentCommentary(prompt) {
    const outputDiv = document.getElementById('agent-output');
    const loadingDiv = document.getElementById('agent-loading');
    
    loadingDiv.style.display = 'block';
    
    try {
        const url = `https://dashscope.aliyuncs.com/api/v1/apps/${agentConfig.appId}/completion`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${agentConfig.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                input: { prompt: prompt },
                parameters: {},
                debug: {}
            })
        });

        const data = await response.json();
        const text = data.output && data.output.text ? data.output.text : "AI 未返回解析内容";
        
        // 渲染到页面
        outputDiv.innerHTML = text.replace(/\n/g, '<br>'); 
    } catch (err) {
        outputDiv.textContent = "Agent 呼叫失败: " + err.message;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

function savePromptLocally(promptText, moveNumber) {
    const blob = new Blob([promptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // 文件名包含当前手数，方便区分
    a.download = `agent_prompt_move_${moveNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("调试信息已导出: agent_prompt_move_" + moveNumber + ".txt");
}
// 分析按钮
// 提取出的核心分析函数
async function triggerAnalysis() {
    // 获取开关元素
    const toggle = document.getElementById('autoAnalyzeToggle');
    const analyzeBtn = document.getElementById('analyzeBtn');

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "分析中...";
    
    /*const postData = {
        board_state: {
            size: boardSize,
            to_play: boardState.to_play,
            move_number: boardState.move_number,
            stones: boardState.stones
        }
    };*/
  // 构造发送给后端的 history 序列
    const history = boardState.movesHistory.map(m => [
        m.color === 'black' ? 'B' : 'W',
        xyToGTP(m.x, m.y, boardSize) // 使用刚才定义的函数
    ]);

    const postData = {
        board_state: {
            size: boardSize,
            to_play: boardState.to_play,
            history: history, // 发送完整历史，解决 turnNumber: 0 问题
            stones: boardState.stones
        }
    };

    try {
        const res = await fetch('http://direct.virtaicloud.com:49711/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
        });
        const result = await res.json();
        // 渲染 UI
        visualizeKatagoOutput(result.katago_output);
            // --- 新增：触发 Agent 自然语言点评 ---
            // 构造 Prompt
        // 如果 result 中包含后端传回的 rag_context，直接传入
        const agentPrompt = buildAgentPrompt(
            result.katago_output, 
            boardState, 
            
        );
        // --- 调试：保存 Prompt 到本地 ---
        //savePromptLocally(agentPrompt, boardState.move_number);
        // 发送给 Agent
        fetchAIAgentCommentary(agentPrompt);
        // ------------------------------------
    } catch (err) {
        console.error("分析失败", err);
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "单步局势分析与推荐";
    }
}

// 绑定开关即时触发
document.getElementById('autoAnalyzeToggle').addEventListener('change', function() {
    if (this.checked) {
        triggerAnalysis();
    } else {
        // 关闭时立即清理棋盘上的推荐点和 PV 线
        document.querySelectorAll('.hint').forEach(el => el.remove());
        if (typeof clearPVMarks === 'function') clearPVMarks();
        if (typeof clearPVLines === 'function') clearPVLines();
    }
});
// 按钮保留手动触发功能
document.getElementById('analyzeBtn').addEventListener('click', triggerAnalysis);
// ===== 简单的落子倒计时规则实现 =====
const MOVE_TIME = 30; // 每次落子固定 30s
const MAX_TIMEOUTS = 3; // 每方最多 3 次超时机会
let timerInterval = null;
let remainingSeconds = MOVE_TIME;
let timeoutCounts = { black: 0, white: 0 };
let gameOver = false;
// 是否启用计时（默认关闭）。仅在用户点击“开始计时”后启用
let timerEnabled = false;

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function updateTimerDisplays() {
    const bt = document.getElementById('black-time');
    const wt = document.getElementById('white-time');
    const bc = document.getElementById('black-chances');
    const wc = document.getElementById('white-chances');
    if (bt) bt.textContent = formatTime(boardState.to_play === 'black' ? remainingSeconds : MOVE_TIME);
    if (wt) wt.textContent = formatTime(boardState.to_play === 'white' ? remainingSeconds : MOVE_TIME);
    if (bc) bc.textContent = `超时: ${timeoutCounts.black}/${MAX_TIMEOUTS} · 30秒`;
    if (wc) wc.textContent = `超时: ${timeoutCounts.white}/${MAX_TIMEOUTS} · 30秒`;
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function startTimer() {
    stopTimer();
    if (gameOver) return;
    remainingSeconds = MOVE_TIME;
    updateTimerDisplays();
    timerInterval = setInterval(() => {
        if (gameOver) { stopTimer(); return; }
        remainingSeconds--;
        updateTimerDisplays();
        if (remainingSeconds <= 0) {
            stopTimer();
            handleTimeout();
        }
    }, 1000);
}

function handleTimeout() {
    const side = boardState.to_play; // 'black' 或 'white'
    timeoutCounts[side] = (timeoutCounts[side] || 0) + 1;
    updateTimerDisplays();
    if (timeoutCounts[side] >= MAX_TIMEOUTS) {
        gameOver = true;
        alert((side === 'black' ? '黑方' : '白方') + ' 超时 3 次，判负。');
        // 禁用棋盘交互
        document.querySelectorAll('.cell').forEach(c => c.style.pointerEvents = 'none');
        const ab = document.getElementById('analyzeBtn'); if (ab) ab.disabled = true;
        const ub = document.getElementById('undoBtn'); if (ub) ub.disabled = true;
        return;
    } else {
        alert((side === 'black' ? '黑方' : '白方') + ` 超时，本方已使用 ${timeoutCounts[side]} 次机会，轮到对方。`);
        // 切换执子方（不落子），开始对方计时
        boardState.to_play = boardState.to_play === 'black' ? 'white' : 'black';
        updateTurnIndicator();
        if (timerEnabled) startTimer();
    }
}

function onMoveMade() {
    if (gameOver) return;
    // 正常落子后停止当前计时并为对方启动新一轮计时
    stopTimer();
    if (timerEnabled) setTimeout(() => { startTimer(); }, 60);
}

// 初始同步行棋提示并启动计时
updateTurnIndicator();
// 计时默认不自动启动，用户需点击“开始计时”按钮
}

// 在 DOM 准备后调用 init
document.addEventListener('DOMContentLoaded', init);