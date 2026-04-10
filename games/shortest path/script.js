const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let nodes = [], edges = [], startNode = null, endNode = null, mode = null;
let dragNode = null, connectFrom = null, shortestPath = [];

class Node {
    constructor(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.radius = 25;
    }
    
    contains(x, y) {
        return Math.hypot(x - this.x, y - this.y) < this.radius;
    }
    
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this === startNode ? '#4CAF50' : this === endNode ? '#F44336' : '#2196F3';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.id, this.x, this.y);
    }
}

class Edge {
    constructor(from, to) {
        this.from = from;
        this.to = to;
        this.weight = Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 10);
    }
    
    draw(highlight = false) {
        ctx.beginPath();
        ctx.moveTo(this.from.x, this.from.y);
        ctx.lineTo(this.to.x, this.to.y);
        ctx.strokeStyle = highlight ? '#4CAF50' : '#999';
        ctx.lineWidth = highlight ? 5 : 2;
        ctx.stroke();
        
        const mx = (this.from.x + this.to.x) / 2;
        const my = (this.from.y + this.to.y) / 2;
        ctx.fillStyle = '#333';
        ctx.fillRect(mx - 15, my - 10, 30, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.weight, mx, my);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    edges.forEach(e => e.draw(shortestPath.includes(e)));
    nodes.forEach(n => n.draw());
}

canvas.addEventListener('mousedown', e => {
    const x = e.clientX, y = e.clientY;
    const node = nodes.find(n => n.contains(x, y));
    
    if (mode === 'add') {
        if (!node) {
            nodes.push(new Node(x, y, nodes.length + 1));
            draw();
        }
    } else if (mode === 'connect') {
        if (node) {
            if (!connectFrom) {
                connectFrom = node;
            } else if (connectFrom !== node && !edges.find(e => 
                (e.from === connectFrom && e.to === node) || (e.from === node && e.to === connectFrom))) {
                edges.push(new Edge(connectFrom, node));
                connectFrom = null;
                draw();
            }
        }
    } else if (mode === 'start' && node) {
        startNode = node;
        mode = null;
        document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
        draw();
    } else if (mode === 'end' && node) {
        endNode = node;
        mode = null;
        document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
        draw();
    } else if (node) {
        dragNode = node;
    }
});

canvas.addEventListener('mousemove', e => {
    if (dragNode) {
        dragNode.x = e.clientX;
        dragNode.y = e.clientY;
        edges.forEach(edge => {
            if (edge.from === dragNode || edge.to === dragNode) {
                edge.weight = Math.round(Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y) / 10);
            }
        });
        if (shortestPath.length > 0) calculatePath();
        draw();
    }
});

canvas.addEventListener('mouseup', () => dragNode = null);

document.getElementById('addNode').addEventListener('click', function() {
    setMode('add', this);
});

document.getElementById('connectMode').addEventListener('click', function() {
    setMode('connect', this);
    connectFrom = null;
});

document.getElementById('setStart').addEventListener('click', function() {
    setMode('start', this);
});

document.getElementById('setEnd').addEventListener('click', function() {
    setMode('end', this);
});

function setMode(m, btn) {
    if (mode === m) {
        mode = null;
        btn.classList.remove('active');
        connectFrom = null;
    } else {
        document.querySelectorAll('.controls button').forEach(b => b.classList.remove('active'));
        mode = m;
        btn.classList.add('active');
    }
}

function calculatePath() {
    if (!startNode || !endNode) return;
    
    const dist = new Map();
    const prev = new Map();
    nodes.forEach(n => dist.set(n, Infinity));
    dist.set(startNode, 0);
    
    const unvisited = new Set(nodes);
    
    while (unvisited.size) {
        let current = [...unvisited].reduce((min, n) => dist.get(n) < dist.get(min) ? n : min);
        if (current === endNode) break;
        if (dist.get(current) === Infinity) break;
        unvisited.delete(current);
        
        edges.filter(e => e.from === current || e.to === current).forEach(edge => {
            const neighbor = edge.from === current ? edge.to : edge.from;
            if (unvisited.has(neighbor)) {
                const alt = dist.get(current) + edge.weight;
                if (alt < dist.get(neighbor)) {
                    dist.set(neighbor, alt);
                    prev.set(neighbor, { node: current, edge });
                }
            }
        });
    }
    
    shortestPath = [];
    if (dist.get(endNode) === Infinity) return;
    
    let curr = endNode;
    while (prev.has(curr)) {
        const p = prev.get(curr);
        shortestPath.push(p.edge);
        curr = p.node;
    }
}

document.getElementById('findPath').addEventListener('click', () => {
    if (!startNode || !endNode) return alert('Set start and end nodes!');
    calculatePath();
    if (shortestPath.length === 0) alert('No path found!');
    draw();
});

document.getElementById('clear').addEventListener('click', () => {
    shortestPath = [];
    draw();
});

document.getElementById('reset').addEventListener('click', () => {
    nodes = [];
    edges = [];
    startNode = endNode = null;
    shortestPath = [];
    draw();
});

document.getElementById('save').addEventListener('click', () => {
    const data = {
        nodes: nodes.map(n => ({ x: n.x, y: n.y, id: n.id })),
        edges: edges.map(e => ({ from: e.from.id, to: e.to.id })),
        startId: startNode?.id,
        endId: endNode?.id
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'graph.json';
    a.click();
});

document.getElementById('load').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            const data = JSON.parse(event.target.result);
            nodes = data.nodes.map(n => new Node(n.x, n.y, n.id));
            edges = data.edges.map(e => {
                const from = nodes.find(n => n.id === e.from);
                const to = nodes.find(n => n.id === e.to);
                return new Edge(from, to);
            });
            startNode = nodes.find(n => n.id === data.startId) || null;
            endNode = nodes.find(n => n.id === data.endId) || null;
            shortestPath = [];
            draw();
        };
        reader.readAsText(file);
    };
    input.click();
});

draw();
