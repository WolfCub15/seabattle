const express = require('express');//загрузка модуля express
const http = require('http');//загрузка HTTP модуля
const path = require('path');
const socketIO = require('socket.io');

const app = express();//создание приложения Express
const server = http.createServer(app);
const io = socketIO(server);
//БД
var connection = require("./db");
const insert_inf = 'INSERT INTO game(Дата, Время, Исход) VALUES($1,$2,$3)';
var t0;
var start = 0;

app.use('/public', express.static(__dirname + '/public'));
//стартовая страница
app.get('/', function(request,res){
  if(start===0) {
    res.sendFile(path.join(__dirname, 'start.html'));
    start =1;
  }
  else {
    res.sendFile(path.join(__dirname, 'start2.html'));
    start =0;
  }
});
//переход на страницу с игрой
app.post('/', function(request,res){
  res.redirect('/game');
});
app.get('/game', function(request, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.post('/game', function(request,res){
  let insert_inf = 'SELECT * FROM game';
  connection.query(insert_inf).then(ans =>{
    ans = ans.rows;
    //console.log(ans.length);
    let text = "<table border=\"3\"><tr><th>Дата</th><th>Время</th><th>Исход</th></tr>";
    for (let i = 0; i < ans.length; i++) {
      text += "<tr>";
      text += "<td>" + ans[i]["Дата"] + "</td>";
      text += "<td>" + ans[i]["Время"] + "</td>";
      text += "<td>" + ans[i]["Исход"] + "</td>";
      text += "</tr>";
    }
    text += "</table>";
    res.send(text);
  })
});
// Когда сервер запускается, выводится лог
server.listen(3000, function() {
  console.log('Listen on port:  ' + 3000);
});
/*****************************************************************************************************************************************************/
const Data = { count: 10, ship_count: [4, 3, 2, 1], around: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] };
const states = { empty: 0, ship1: 1, ship2: 2, ship3: 3, ship4: 4, miss: 5, wounded: 6, destroyed: 7, dist: 8 };

//одна клеточка
class Cell {
  constructor() { this.typeField = states.empty; }
  set type(value) { this.typeField = value; }
  get type() { return this.typeField; }
}

function random() {
  const a = [0,1,2,3,4,5,6,7,8,9];
  for (let i = 9; i > 0; --i) {
    const j = Math.floor(Math.random() * (i + 1));// returns a random integer from 0 to i+1
    [a[i], a[j]] = [a[j], a[i]];//swap
  }
  return a;
}

function rand() {
    const pairs = Array.apply(null, Array(2)).map(() => random());
    return pairs[0].map((x) => pairs[1].map(y => [x, y])).reduce((a, b) => a.concat(b));
}

//получить координаты корабля
function getShipCoordinates(field, x, y, size, position) {
   const ship = [];
   if (position) {
      for (let i = 0; i < size; ++i) {
        if (field[y][x + i]){
          var tmp = { x: x + i, y: y, type: field[y][x + i].type };
          ship.push(tmp);
        }
      }
   } 
   else {
      for (let i = 0; i < size; ++i) {
        if (field[y + i]){
          var tmp = { x: x, y: y + i, type: field[y + i][x].type };
          ship.push(tmp);
        }
      }
    }
    return ship;
}

//найти место для корабля
function findPlace(field, a, size, position) {
    for (let [x, y] of a) {
      let ship = getShipCoordinates(field, x, y, size, position);
      if (ship.length === size && ship.every(x => x.type === states.empty)) return [x, y];
    }
}

//заполнить вокруг корабля(вокруг каждой клеточки максимум 8 других)
function aroundTheShip(field, x, y) {
    Data.around.forEach(([i, j]) => {
      let cell = field[y + j] && field[y + j][x + i];
      if (cell && cell.type === states.empty) cell.type = states.dist;
    });
}

function destroyedShip(field, ship) {
    const miss_a = [];
    ship.forEach(({x, y}) => {
      let cell0 = field[y][x];
      cell0.type = states.destroyed;
      let tmp = {x: x, y: y, type: cell0.type};
      miss_a.push(tmp);
      Data.around.forEach(([i, j]) => { 
        let cell = field[y + j] && field[y + j][x + i];
        if (cell && cell.type === states.empty) {
          cell.type = states.miss;
          let tmp = {x: x + i, y: y + j, type: cell.type};
          miss_a.push(tmp);
        }
      });
    });
    return miss_a;
}
//создание пустого поля с нулевыми ячейками
function createBattlefield() {
    const n = Data.count;
    const field = Array.apply(null, Array(n)).map(() => Array(n));//матрица 10х10
    field.forEach((x, i) => { 
      field[i] = Array.apply(null, Array(n)).map(() => new Cell);
    });
    return field;
}
/*****************************************************************************************************************************************************/
class Id {
  constructor(server_id, client_id) {
    this.server_id = server_id;
    this.client_id = client_id;
  }
  get serverID() { return this.server_id;}
}

class infId {
  constructor() { this.ids = [];}
  getId(socket_id) {
    if (this.ids.length >= 2)  return null;
    const newId = new Id(this.ids.length, socket_id);
    if (this.ids.length === 0) this.whoPlay = newId;
    this.ids.push(newId);
    console.log(newId);
    return newId;
  }
  current() {
    return this.whoPlay;
  }
  next(x) {
    if (x==0) this.whoPlay = this.ids[ 1 - this.ids.indexOf(this.whoPlay)];
    return this.whoPlay;
  }
}
/*****************************************************************************************************************************************************/

class Game {
  constructor() {
    this.players = [{}, {}];
    this.players.forEach(player => { 
      player.field = createBattlefield(); 
      player.fieldEnemy = createBattlefield(); 
      player.fleet = { fleet_list: [], coord: {}, number: 10 }; 
    }); 
    this.players.forEach(player => this.generateShips(player));
    this.inf_id = new infId();
  }
  generateShips(player) {
    const field = player.field;
    const fleet = player.fleet;
    const fleet_list = fleet.fleet_list;
    const ship_count = Data.ship_count;
    for (let i = 3; i >= 0; --i) {
      let size = i + 1;
      for (let j = ship_count[i]; j > 0; --j) {
        const rand_vec = rand();
        let position = Math.random() >= 0.5;//генерирует псевдослучайное число в диапазоне от 0 до 1(вертик/гориз)
        let [x, y] = findPlace(field, rand_vec, size, position);
        let shipCoords = getShipCoordinates(field, x, y, size, position);
        shipCoords.forEach( cell => field[cell.y][cell.x].type = states[`ship${size}`]);//обновляем тип
        fleet_list.push(shipCoords);
        shipCoords.forEach(({x, y}) => fleet.coord[y + ',' + x] = fleet_list[fleet_list.length - 1]);
        shipCoords.forEach(value => aroundTheShip(field, value.x, value.y));
      }
    }
    //заполнить все оставшиеся клетки 
    field.forEach( row => row.forEach(cell => {
      if (cell.type === states.dist) {
        cell.type = states.empty;
      }
    }));
  }
};
/*****************************************************************************************************************************************************/
//взаимодействие между сервером и клиентом
var keke =0;
//console.log(`I'm here!!!`);
var players = {};
var game = new Game();
io.on('connection', socket => {
  const inf_id = game.inf_id;
  const ids_information = inf_id.getId(socket.id);
  if (ids_information === null) return;
    console.log(`${socket.id} connected`);  
    if( keke === 1) keke = 1;
    else {
      t0 = new Date().getTime();
      keke = 0;
    }
    players[ids_information.serverID] = game.players[ids_information.serverID]; 
    var tmptmp = [players[ids_information.serverID], Data, states, inf_id.current().client_id];
    socket.emit('initialization', tmptmp);   
    socket.on('update', update(players, inf_id, ids_information));
    var tmp = {status: 'interruption', who_disc: socket.id };
    socket.on('disconnect', disconnect(tmp));
  });   

function update(players, inf_id, newId) { return k => {
  const player = players[newId.serverID];
  const enemy = players[1 - newId.serverID];
  const {x,y} = k;
  let lolo = 0;
  if (!enemy || !enemy.field) return;      
  const cell = enemy.field[y][x];
  const type = cell.type;
  if(type===states.empty) cell.type = states.miss;
  if(type===states.ship1 || type === states.ship2 || type === states.ship3 || type ===states.ship4){
    cell.type = states.wounded;
    console.log(enemy.fleet.coord);
    enemy.fleet.coord[y + ',' + x].filter((ship_i) => ship_i.x === x && ship_i.y === y)[0].type = states.wounded;
    lolo = 1;
  }
  const next = inf_id.next(lolo);
  var tmp = { who_now: newId.client_id, who_next: next.client_id, x, y, type: cell.type};
  io.sockets.emit('updateC', tmp);

  if (lolo) {
    const ship = enemy.fleet.coord[y + ',' + x];
    if (ship.every(({type}) => type === states.wounded)) {
      const a = destroyedShip(enemy.field, ship);
      a.forEach(({x, y, type}) => {
        var tmp = { who_now: newId.client_id, who_next: next.client_id, x:x, y:y, type:type};
        io.sockets.emit('updateC', tmp);
      });
      enemy.fleet.number--;
    }
    if (!enemy.fleet.number) {
      var tmp = {status: 'end', winner: newId.client_id};
      disconnect(tmp)();
    }
  }
}}

function disconnect(cause) { return () => {
  if (Object.keys(players).length === 2) {
  if(cause.status ==='end'){
    console.log(`${cause.winner} wins`);
    let curr_date = new Date();
    var t1 = new Date().getTime();
    var time = (t1-t0) * 0.001;
    var wiwi  = String(cause.winner);
    //console.log(wiwi);
    const tmp = [curr_date, time , wiwi];
    connection.query(insert_inf,tmp,(err, res) => {//результат в БД
    if (err) {
      console.log(err.stack)
    }
    });
    game = new Game();
    players = {};
    io.sockets.emit('stop', cause);
  }
  if(cause.status ==='interruption'){
    console.log(`${cause.who_disc} disconnected`);
    game = new Game();
    players = {};
    io.sockets.emit('stop', cause);
  }
}
} }
