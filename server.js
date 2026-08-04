const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静的ファイルの提供（index.htmlを同じフォルダに置く場合）
app.use(express.static(__dirname));

let players = {};
let bullets = [];

io.on('connection', (socket) => {
    console.log(`プレイヤー接続: ${socket.id}`);

    // 新規プレイヤーの初期化（チーム分け：ランダムまたは交互）
    const team = Object.keys(players).length % 2 === 0 ? 'Team A' : 'Team B';
    players[socket.id] = {
        x: Math.random() * 700 + 50,
        y: Math.random() * 500 + 50,
        size: 18,
        color: team === 'Team A' ? '#00ffcc' : '#ff4444',
        team: team,
        angle: 0,
        hp: 100
    };

    // プレイヤーの移動や向きの更新
    socket.on('playerUpdate', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
        }
    });

    // 弾の発射
    socket.on('shoot', (bulletData) => {
        bullets.push({
            id: Math.random().toString(36).substr(2, 9),
            x: bulletData.x,
            y: bulletData.y,
            vx: bulletData.vx,
            vy: bulletData.vy,
            team: players[socket.id] ? players[socket.id].team : ''
        });
    });

    socket.on('disconnect', () => {
        console.log(`プレイヤー切断: ${socket.id}`);
        delete players[socket.id];
    });
});

// ゲームのメインループ（サーバー側で物理・判定を管理）
setInterval(() => {
    // 弾の移動とヒット判定
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // 画面外で消去
        if (b.x < 0 || b.x > 800 || b.y < 0 || b.y > 600) {
            bullets.splice(i, 1);
            continue;
        }

        // プレイヤーとの当たり判定
        let hit = false;
        for (let id in players) {
            let p = players[id];
            // 敵チームの弾のみヒットする
            if (p.team !== b.team) {
                let dist = Math.hypot(p.x - b.x, p.y - b.y);
                if (dist < p.size + 4) {
                    p.hp -= 20; // ダメージ
                    hit = true;
                    if (p.hp <= 0) {
                        p.hp = 100; // リスポーン（簡易）
                        p.x = Math.random() * 700 + 50;
                        p.y = Math.random() * 500 + 50;
                    }
                    break;
                }
            }
        }
        if (hit) {
            bullets.splice(i, 1);
        }
    }

    // 全クライアントへ最新の状態を送信
    io.emit('gameState', { players, bullets });
}, 1000 / 60);

server.listen(3000, () => {
    console.log('サーバーが起動しました: http://localhost:3000');
});