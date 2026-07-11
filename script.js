const BOARD_SIZE = 14;
const EMPTY = -1;

const players = [
  { id: 0, name: "あなた", className: "human", start: { x: 0, y: BOARD_SIZE - 1 } },
  { id: 1, name: "CPU", className: "cpu", start: { x: BOARD_SIZE - 1, y: 0 } },
];

const pieces = [
  { id: "solo", name: "Solo", cells: [[0, 0]] },
  { id: "duo", name: "Duo", cells: [[0, 0], [1, 0]] },
  { id: "line3", name: "Line 3", cells: [[0, 0], [1, 0], [2, 0]] },
  { id: "corner3", name: "Corner 3", cells: [[0, 0], [0, 1], [1, 1]] },
  { id: "square4", name: "Square", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "line4", name: "Line 4", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: "tee4", name: "Tee", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: "ell4", name: "Ell", cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { id: "zig4", name: "Zig", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { id: "plus5", name: "Plus", cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: "you5", name: "Cup", cells: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { id: "hook5", name: "Hook", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]] },
];

const boardEl = document.querySelector("#board");
const trayEl = document.querySelector("#piece-tray");
const previewEl = document.querySelector("#piece-preview");
const selectedNameEl = document.querySelector("#selected-piece-name");
const messageEl = document.querySelector("#message-bar");
const turnLabelEl = document.querySelector("#turn-label");
const turnChipEl = document.querySelector("#turn-chip");
const humanScoreEl = document.querySelector("#human-score");
const cpuScoreEl = document.querySelector("#cpu-score");

let board;
let currentPlayer;
let selectedPieceId;
let rotation;
let flipped;
let hoverCell;
let usedPieces;
let consecutivePasses;
let gameOver;

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function normalize(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function transformCells(piece, pieceRotation = rotation, pieceFlipped = flipped) {
  let cells = piece.cells.map(([x, y]) => [pieceFlipped ? -x : x, y]);
  for (let index = 0; index < pieceRotation; index += 1) {
    cells = cells.map(([x, y]) => [-y, x]);
  }
  return normalize(cells);
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function uniqueTransforms(piece) {
  const seen = new Set();
  const transforms = [];
  [false, true].forEach((isFlipped) => {
    [0, 1, 2, 3].forEach((turns) => {
      const cells = transformCells(piece, turns, isFlipped);
      const key = cells.map(([x, y]) => cellKey(x, y)).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        transforms.push(cells);
      }
    });
  });
  return transforms;
}

function placedCells(cells, x, y) {
  return cells.map(([cellX, cellY]) => ({ x: x + cellX, y: y + cellY }));
}

function hasAnyPiece(playerId) {
  return board.some((row) => row.some((value) => value === playerId));
}

function inside(x, y) {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function validatePlacement(playerId, cells, x, y) {
  const absoluteCells = placedCells(cells, x, y);
  if (absoluteCells.some((cell) => !inside(cell.x, cell.y) || board[cell.y][cell.x] !== EMPTY)) {
    return { ok: false, reason: "そこには置けません。" };
  }

  const sideDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const cornerDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const hasStarted = hasAnyPiece(playerId);
  let touchesCorner = false;
  let coversStart = false;

  for (const cell of absoluteCells) {
    const start = players[playerId].start;
    if (cell.x === start.x && cell.y === start.y) {
      coversStart = true;
    }

    for (const [dx, dy] of sideDirections) {
      const nextX = cell.x + dx;
      const nextY = cell.y + dy;
      if (inside(nextX, nextY) && board[nextY][nextX] === playerId) {
        return { ok: false, reason: "自分の色とは辺で接してはいけません。" };
      }
    }

    for (const [dx, dy] of cornerDirections) {
      const nextX = cell.x + dx;
      const nextY = cell.y + dy;
      if (inside(nextX, nextY) && board[nextY][nextX] === playerId) {
        touchesCorner = true;
      }
    }
  }

  if (!hasStarted && !coversStart) {
    return { ok: false, reason: "最初のピースはスタート角に置きます。" };
  }

  if (hasStarted && !touchesCorner) {
    return { ok: false, reason: "自分の色と角でつながる場所に置きます。" };
  }

  return { ok: true, reason: "置けます。" };
}

function placePiece(playerId, pieceId, cells, x, y) {
  placedCells(cells, x, y).forEach((cell) => {
    board[cell.y][cell.x] = playerId;
  });
  usedPieces[playerId].add(pieceId);
  consecutivePasses = 0;
}

function scoreFor(playerId) {
  return board.flat().filter((value) => value === playerId).length;
}

function availablePieceIds(playerId) {
  return pieces.map((piece) => piece.id).filter((id) => !usedPieces[playerId].has(id));
}

function findFirstAvailablePiece(playerId) {
  return availablePieceIds(playerId)[0] || null;
}

function hasValidMove(playerId) {
  return Boolean(findBestMove(playerId, false));
}

function findBestMove(playerId, withRandomness = true) {
  let bestMove = null;
  for (const piece of pieces) {
    if (usedPieces[playerId].has(piece.id)) continue;
    for (const cells of uniqueTransforms(piece)) {
      for (let y = 0; y < BOARD_SIZE; y += 1) {
        for (let x = 0; x < BOARD_SIZE; x += 1) {
          const result = validatePlacement(playerId, cells, x, y);
          if (!result.ok) continue;
          const centerBias = 12 - Math.abs(BOARD_SIZE / 2 - x) - Math.abs(BOARD_SIZE / 2 - y);
          const randomTie = withRandomness ? Math.random() * 1.5 : 0;
          const value = cells.length * 10 + centerBias + randomTie;
          if (!bestMove || value > bestMove.value) {
            bestMove = { pieceId: piece.id, cells, x, y, value };
          }
        }
      }
    }
  }
  return bestMove;
}

function previewSet() {
  if (gameOver || currentPlayer !== 0 || !selectedPieceId || !hoverCell) {
    return { cells: new Set(), valid: false };
  }
  const piece = pieces.find((item) => item.id === selectedPieceId);
  const cells = transformCells(piece);
  const validation = validatePlacement(0, cells, hoverCell.x, hoverCell.y);
  const keys = new Set(placedCells(cells, hoverCell.x, hoverCell.y).map((cell) => cellKey(cell.x, cell.y)));
  return { cells: keys, valid: validation.ok };
}

function renderBoard() {
  const preview = previewSet();
  boardEl.innerHTML = "";
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const button = document.createElement("button");
      const value = board[y][x];
      button.type = "button";
      button.className = "cell";
      button.dataset.x = x;
      button.dataset.y = y;
      button.setAttribute("aria-label", `${x + 1}列 ${y + 1}行`);
      if (value !== EMPTY) button.classList.add(players[value].className);
      if (x === players[0].start.x && y === players[0].start.y) button.classList.add("start-human");
      if (x === players[1].start.x && y === players[1].start.y) button.classList.add("start-cpu");
      if (preview.cells.has(cellKey(x, y)) && value === EMPTY) {
        button.classList.add(preview.valid ? "preview-valid" : "preview-invalid");
      }
      boardEl.append(button);
    }
  }
}

function renderPiecePreview() {
  const piece = pieces.find((item) => item.id === selectedPieceId) || pieces[0];
  const cells = new Set(transformCells(piece).map(([x, y]) => cellKey(x + 1, y + 1)));
  selectedNameEl.textContent = piece ? piece.name : "なし";
  previewEl.innerHTML = "";
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      const cell = document.createElement("span");
      cell.className = `preview-cell${cells.has(cellKey(x, y)) ? " on" : ""}`;
      previewEl.append(cell);
    }
  }
}

function miniPiece(piece) {
  const cells = new Set(normalize(piece.cells).map(([x, y]) => cellKey(x + 1, y + 1)));
  let html = '<span class="mini-piece" aria-hidden="true">';
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      html += `<span class="mini-cell${cells.has(cellKey(x, y)) ? " on" : ""}"></span>`;
    }
  }
  return `${html}</span>`;
}

function renderTray() {
  trayEl.innerHTML = pieces.map((piece) => {
    const used = usedPieces[0].has(piece.id);
    const selected = selectedPieceId === piece.id;
    return `
      <button type="button" class="piece-button${selected ? " is-selected" : ""}${used ? " is-used" : ""}" data-piece="${piece.id}" ${used ? "disabled" : ""} title="${piece.name}">
        ${miniPiece(piece)}
      </button>
    `;
  }).join("");
}

function renderStatus() {
  humanScoreEl.textContent = scoreFor(0);
  cpuScoreEl.textContent = scoreFor(1);
  turnLabelEl.textContent = gameOver ? "ゲーム終了" : currentPlayer === 0 ? "あなたの番" : "CPUの番";
  turnChipEl.textContent = gameOver ? winnerText() : currentPlayer === 0 ? "Place a piece" : "Thinking";
}

function render() {
  renderBoard();
  renderTray();
  renderPiecePreview();
  renderStatus();
}

function setMessage(text) {
  messageEl.textContent = text;
}

function winnerText() {
  const human = scoreFor(0);
  const cpu = scoreFor(1);
  if (human > cpu) return "You win";
  if (cpu > human) return "CPU wins";
  return "Draw";
}

function finishGame() {
  gameOver = true;
  const human = scoreFor(0);
  const cpu = scoreFor(1);
  if (human > cpu) setMessage(`勝ちです。${human} - ${cpu} であなたの方が広く置けました。`);
  else if (cpu > human) setMessage(`CPUの勝ちです。${human} - ${cpu}。次は角を早めに広げると戦えます。`);
  else setMessage(`引き分けです。${human} - ${cpu}。かなりいい勝負でした。`);
  render();
}

function switchTurn() {
  if (gameOver) return;
  if (consecutivePasses >= 2 || (!hasValidMove(0) && !hasValidMove(1))) {
    finishGame();
    return;
  }
  currentPlayer = currentPlayer === 0 ? 1 : 0;
  if (currentPlayer === 0) {
    selectedPieceId = selectedPieceId && !usedPieces[0].has(selectedPieceId) ? selectedPieceId : findFirstAvailablePiece(0);
    if (!hasValidMove(0)) {
      consecutivePasses += 1;
      setMessage("あなたは置ける場所がありません。自動でパスします。 ");
      switchTurn();
      return;
    }
    setMessage("あなたの番です。角でつながる場所を探してください。 ");
    render();
  } else {
    setMessage("CPUが考えています。 ");
    render();
    window.setTimeout(cpuTurn, 450);
  }
}

function handleHumanPlacement(x, y) {
  if (gameOver || currentPlayer !== 0 || !selectedPieceId) return;
  const piece = pieces.find((item) => item.id === selectedPieceId);
  const cells = transformCells(piece);
  const result = validatePlacement(0, cells, x, y);
  if (!result.ok) {
    setMessage(result.reason);
    hoverCell = { x, y };
    renderBoard();
    return;
  }
  placePiece(0, selectedPieceId, cells, x, y);
  selectedPieceId = findFirstAvailablePiece(0);
  hoverCell = null;
  setMessage(`${piece.name} を置きました。`);
  switchTurn();
}

function cpuTurn() {
  if (gameOver || currentPlayer !== 1) return;
  const move = findBestMove(1, true);
  if (!move) {
    consecutivePasses += 1;
    setMessage("CPUはパスしました。 ");
    switchTurn();
    return;
  }
  placePiece(1, move.pieceId, move.cells, move.x, move.y);
  const pieceName = pieces.find((piece) => piece.id === move.pieceId).name;
  setMessage(`CPUが ${pieceName} を置きました。`);
  switchTurn();
}

function passTurn() {
  if (gameOver || currentPlayer !== 0) return;
  consecutivePasses += 1;
  setMessage("あなたはパスしました。 ");
  switchTurn();
}

function newGame() {
  board = createBoard();
  currentPlayer = 0;
  selectedPieceId = pieces[0].id;
  rotation = 0;
  flipped = false;
  hoverCell = null;
  usedPieces = [new Set(), new Set()];
  consecutivePasses = 0;
  gameOver = false;
  setMessage("ピースを選んで、盤面に置いてください。 ");
  render();
}

boardEl.addEventListener("mouseover", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  hoverCell = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
  renderBoard();
});

boardEl.addEventListener("mouseleave", () => {
  hoverCell = null;
  renderBoard();
});

boardEl.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  handleHumanPlacement(Number(cell.dataset.x), Number(cell.dataset.y));
});

trayEl.addEventListener("click", (event) => {
  const button = event.target.closest(".piece-button");
  if (!button || button.disabled || currentPlayer !== 0 || gameOver) return;
  selectedPieceId = button.dataset.piece;
  rotation = 0;
  flipped = false;
  setMessage(`${pieces.find((piece) => piece.id === selectedPieceId).name} を選びました。`);
  render();
});

document.querySelector("#rotate-piece").addEventListener("click", () => {
  if (gameOver || currentPlayer !== 0) return;
  rotation = (rotation + 1) % 4;
  render();
});

document.querySelector("#flip-piece").addEventListener("click", () => {
  if (gameOver || currentPlayer !== 0) return;
  flipped = !flipped;
  render();
});

document.querySelector("#pass-turn").addEventListener("click", passTurn);
document.querySelector("#new-game").addEventListener("click", newGame);

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") {
    rotation = (rotation + 1) % 4;
    render();
  }
  if (event.key.toLowerCase() === "f") {
    flipped = !flipped;
    render();
  }
});

newGame();
