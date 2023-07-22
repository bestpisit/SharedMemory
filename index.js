const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/rw', (req, res) => {
    res.sendFile(__dirname + '/rw.html');
});

app.get('/dp', (req, res) => {
    res.sendFile(__dirname + '/dp.html'); // dp.html is the new file for dining philosophers
});

let buffer = [];
const MAX_BUFFER_SIZE = 5;

let readCount = 0;
let data = 'Data';
let mutex = true;
let rwMutex = true;

const forks = [
    { id: 1, status: 1 },
    { id: 2, status: 1 },
    { id: 3, status: 1 },
    { id: 4, status: 1 },
    { id: 5, status: 1 },
];

const philosophers = [
    { id: 1, leftFork: forks[0], rightFork: forks[1], state: "thinking" },
    { id: 2, leftFork: forks[1], rightFork: forks[2], state: "thinking" },
    { id: 3, leftFork: forks[2], rightFork: forks[3], state: "thinking" },
    { id: 4, leftFork: forks[3], rightFork: forks[4], state: "thinking" },
    { id: 5, leftFork: forks[4], rightFork: forks[0], state: "thinking" },
];

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('produce', (item) => {
        console.log('produced:', item);

        if (buffer.length < MAX_BUFFER_SIZE) {
            buffer.push(item);
            io.emit('buffer', buffer);
        }
        else {
            io.emit('starvation', 'Producer is starving');
        }
    });

    socket.on('consume', () => {
        console.log('consumed');

        if (buffer.length > 0) {
            buffer.shift();
            io.emit('buffer', buffer);
        }
        else {
            io.emit('deadlock', 'Consumer is in deadlock');
        }
    });

    socket.on('startRead', () => {
        console.log('Start read request');

        if (mutex) {
            mutex = false;
            readCount++;
            if (readCount == 1) {
                if (rwMutex) {
                    rwMutex = false;
                } else {
                    io.emit('deadlock', 'Reader is in deadlock');
                    return;
                }
            }
            mutex = true;
            io.emit('data', data);
            io.emit('readCount', readCount);
        } else {
            io.emit('deadlock', 'Reader is in deadlock');
        }
    });

    socket.on('stopRead', () => {
        console.log('Stop read request');

        if (mutex && readCount - 1 >= 0) {
            mutex = false;
            readCount--;
            if (readCount == 0) {
                rwMutex = true;
            }
            mutex = true;
            io.emit('readCount', readCount);
        } else {
            io.emit('deadlock', 'Reader is in deadlock');
        }
    });

    socket.on('startWrite', (newData) => {
        console.log('Start write request');

        if (rwMutex) {
            rwMutex = false;
            data = newData;
            io.emit('data', data);
        } else {
            io.emit('deadlock', 'Writer is in deadlock');
        }
    });

    socket.on('stopWrite', () => {
        console.log('Stop write request');
        rwMutex = true;
    });

    // Send the initial state of philosophers and forks
    io.emit('update', { philosophers, forks });

    socket.on('startEat', id => {
        const philosopher = philosophers.find(p => p.id === id);
        if (!philosopher) return;

        // Check if both forks are available
        if (philosopher.leftFork.status === 1 && philosopher.rightFork.status === 1) {
            // Change the philosopher state and fork status
            philosopher.state = "eating";
            philosopher.leftFork.status = 0;
            philosopher.rightFork.status = 0;

            // Send the updated state
            io.emit('update', { philosophers, forks });
        }
    });

    socket.on('stopEat', id => {
        const philosopher = philosophers.find(p => p.id === id);
        if (!philosopher) return;

        // Change the philosopher state and fork status
        philosopher.state = "thinking";
        philosopher.leftFork.status = 1;
        philosopher.rightFork.status = 1;

        // Send the updated state
        io.emit('update', { philosophers, forks });
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});