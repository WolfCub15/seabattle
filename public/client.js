class GameC {
  constructor(socket, player, Data, states) {
    this.player = player;
    this.player.your_table = document.getElementById("playerTable");
    this.player.enemy_table = document.getElementById("enemyTable");
    this.tableCaption = document.querySelector("#playerTable caption");
    this.Data = Data;
    this.lolo = 0;

    this.names = {};
    const val = Object.values(states);
    const name = Object.keys(states);
    val.forEach((i, j) => this.names[i] = name[j]);

    this.createTable(this.player.your_table, player.field);
    this.createTable(this.player.enemy_table, player.fieldEnemy);

    this.player.enemy_table.addEventListener('click', e => {//клики мышкой
      if (!this.lolo) return;
      var td = e.target.closest('td');
      var tr = td.closest('tr') ;
      var res = {};
      res.y = tr.rowIndex - 1;
      res.x = td.cellIndex - 1;
      socket.emit('update', res);
    });
  }

  createTableH(your_table) {
    while (your_table.tHead.firstElementChild) {
      your_table.tHead.removeChild(your_table.tHead.firstElementChild);
    }
    const headers = document.createElement('tr');//строки
    const n = this.Data.count;
    for(let i = 0; i <= n ; ++i) {
      const th = document.createElement('th');//заголовки
      if (i) th.textContent = i;
      headers.appendChild(th);
    }
    your_table.tHead.appendChild(headers);
  }

  createTableB(table, field) {
    while (table.tBodies[0].firstElementChild) {
      table.tBodies[0].removeChild(table.tBodies[0].firstElementChild);
    }
    const n = this.Data.count;
    for(let i = 0; i < n; ++i) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = String.fromCharCode(65 + i);//левый столбец заполняем буквами
      tr.appendChild(th);
      for (let j = 0; j < n; ++j) {
        const td = document.createElement('td');//создаем ячейку
        var tmp = field[i][j].typeField;
        td.classList.add(this.names[tmp]); 
        tr.appendChild(td);
      }
      table.tBodies[0].appendChild(tr);
    }    
  }
  createTable(table, field) {
    this.createTableH(table);
    this.createTableB(table, field);
  }
};

var game;
function updateC() { return ({who_now, who_next, x, y, type}) => {
  var cell,lolo;
  if (who_now === socket.id) cell = game.player.enemy_table.rows[y + 1].cells[x + 1];
  else cell = game.player.your_table.rows[y + 1].cells[x + 1];
  if (who_next === socket.id) lolo = 1;
  else lolo = 0;
  game.lolo = lolo;
  if (lolo) {
    if (!game.tableCaption.classList.contains('who_now')) {
      game.tableCaption.classList.add('who_now');
    }
  } 
  else {
    game.tableCaption.classList.remove('who_now');
  }
  cell.classList.add(game.names[type]);
  }
  }

  socket = io();
  socket.on('initialization', ([player, Data, states, sock]) => {
    game = new GameC(socket, player, Data, states);
    if (sock === socket.id) game.lolo = 1;
    else game.lolo = 0;
    if (game.lolo) game.tableCaption.classList.add('who_now');//показать, чей ход
    socket.on('updateC', updateC());  
    alert(`${sock}`);    
  });
  socket.on('stop', (cause) => {
    if (cause.status === 'interruption') {
      socket.removeListener('updateC', updateC()); 
      alert(`The game is stopped! Refresh the page or go back!`);
    }
    if (cause.status === 'end') {
      socket.removeListener('updateC', updateC()); 
      if (cause.winner === socket.id)alert(`${cause.winner}! YOU WIN  :)`) ;
      else  alert(`${socket.id}! YOU LOSE  :(`);
    }
  });

