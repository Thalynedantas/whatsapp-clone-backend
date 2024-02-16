const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redis = require('redis');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 5000;

const users = [];
const redisClient = redis.createClient();

redisClient.on('ready', () => {
    console.log("Conexão com o Redis está aberta.");
});

redisClient.on('error', (err) => {
    console.error("Erro na conexão com o Redis:", err);
})

io.on('connection', (socket) => { 
    
    socket.on("join", (name) => {
        const user = {id: socket.id, name};
        users.push(user);
        io.emit("message", {name: null, message: `${name} entrou no chat`});
        io.emit("users", users)

        redisClient.hmset("users", socket.id, JSON.stringify(user), (err, reply) => {
            if (err) {
                console.error("Erro ao adicionar usuário ao Redis:", err);
            } else {
                console.log("Usuário adicionado ao Redis:", reply);
            }
        });
    });
    
    socket.on("message", (message) => { // recendo a mensagem no servidor
        if (message.receiverId) {
            io.to(message.receiverId).emit("privateMessage", message);
        } else {
            io.emit("message", message); // transmitindo a mensagem recebida
        }
        
        redisClient.lpush("messages", JSON.stringify(message), (err, reply) => {
            if (err) {
                console.error("Erro ao adicionar mensagem á lista no Redis:", err);
            } else {
                console.log("Mensagem adicionada á lista no Redis:", reply);
            }
        });
    });

    redisClient.lrange("messages", 0, -1, (err, messages) => {
        if (err) {
            console.error("Erro ao recuperar mensagens antigas do Redis:", err);

        } else {
            messages.forEach((message) => {
                socket.emit("message", JSON.parse(message));
            }); 
        }
    });

    socket.on('disconnect', () => {
        const disconnectedUser = users.find(user => user.id === socket.id);
        if (disconnectedUser) {
            users.splice(users.indexOf(disconnectedUser), 1);
            io.emit("users", users);
            io.emit("message", { name: null, message: `${disconnectedUser.name} saiu do chat`});
            
            redisClient.hdel("users", socket.id, (err, reply) => {
                if (err) {
                    console.error("Erro ao remover usuário do Redis:", err);
                } else {
                    console.log("Usuário removido do Redis:", reply);
                }
            });
        }
    });

    if (redisClient.connected) {
        console.log("Conexão com o Redis está aberta.");
} else {
        console.log("Conexão com o Redis está fechada.");
    }
})


server.listen(port, () => console.log(`servidor rodando na porta ${port}`))