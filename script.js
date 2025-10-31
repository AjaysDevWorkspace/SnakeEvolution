// Complete scroll prevention 
(function() {
    var keys = {37: 1, 38: 1, 39: 1, 40: 1}; // Arrow keys

    function preventDefault(e) {
        e.preventDefault();
    }

    function preventDefaultForScrollKeys(e) {
        if (keys[e.keyCode]) {
            preventDefault(e);
            return false;
        }
    }

    // Disable scroll for arrow keys only
    document.onkeydown = preventDefaultForScrollKeys;
})();

const firebaseConfig = {
    apiKey: "AIzaSyDRDvlwalRpidbThvTEMK6FZVsDnK5FSOQ",
    authDomain: "snakeevolution-90ebd.firebaseapp.com",
    projectId: "snakeevolution-90ebd",
    storageBucket: "snakeevolution-90ebd.appspot.com",
    messagingSenderId: "408698178876",
    appId: "1:408698178876:web:86c7ec9e7d802556f2a239"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const loginBtn = document.getElementById('login-btn');
const profileToggle = document.getElementById('profile-toggle');
const profileMenu = document.getElementById('profile-menu');
const profilePic = document.getElementById('profile-pic');
const profileName = document.getElementById('profile-name');
const profilePicMenu = document.getElementById('profile-pic-menu');
const menuUsername = document.getElementById('menu-username');
const menuEmail = document.getElementById('menu-email');
const logoutBtn = document.getElementById('logoutBtn');
const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
const leaderboardSection = document.getElementById('leaderboard-section');
const leaderboardDiv = document.getElementById('leaderboard');
const guestMessage = document.getElementById('guest-message');

profileMenu.style.display = 'none';
document.body.addEventListener('click', e => {
    if (!profileMenu.contains(e.target) && !profileToggle.contains(e.target))
        profileMenu.style.display = 'none';
});
profileToggle.onclick = e => {
    e.stopPropagation();
    profileMenu.style.display = (profileMenu.style.display === 'block') ? 'none' : 'block';
};
loginBtn.onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
};
logoutBtn.onclick = () => {
    auth.signOut();
    profileMenu.style.display = 'none';
    leaderboardSection.style.display = 'none';
};
showLeaderboardBtn.onclick = () => displayLeaderboard();

auth.onAuthStateChanged(user => {
    if (user) {
        loginBtn.style.display = "none";
        profileToggle.style.display = "";
        profilePic.src = user.photoURL || "https://i.imgur.com/LN8kHtP.png";
        profilePicMenu.src = user.photoURL || "https://i.imgur.com/LN8kHtP.png";
        profileName.textContent = user.displayName?.split(' ')[0] || '';
        menuUsername.textContent = uniqueUsername(user);
        menuEmail.textContent = user.email;
        guestMessage.textContent = "";
        loadBestScore();
    } else {
        loginBtn.style.display = "";
        profileToggle.style.display = "none";
        profileMenu.style.display = "none";
        profilePic.src = "https://i.imgur.com/LN8kHtP.png";
        profileName.textContent = '';
        leaderboardSection.style.display = "none";
        guestMessage.textContent = "Login to submit scores and view the leaderboard.";
        loadBestScore();
    }
});

// Unique username generator
function uniqueUsername(user) {
    if (!user) return "";
    const namePart = user.displayName?.replace(/\s+/g, "") || user.email.split('@')[0];
    return namePart + "_" + user.uid.slice(-4);
}

// Display leaderboard
db.enablePersistence().catch(function (err) {
    if (err.code == 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab.');
    } else if (err.code == 'unimplemented') {
        console.warn('Persistence is not available in this browser.');
    }
});

async function displayLeaderboard() {
    leaderboardSection.style.display = 'block';
    const user = auth.currentUser;
    leaderboardDiv.innerHTML = "";
    if (!user) {
        leaderboardDiv.innerHTML = `<p style="color:var(--accent2)">Login to see leaderboard.</p>`;
        return;
    }

    try {
        const query = await db.collection('scores').orderBy('score', 'desc').limit(10).get();

        if (query.empty) {
            leaderboardDiv.innerHTML = `<p style="color:var(--accent2)">No scores yet. Be the first to play!</p>`;
            profileMenu.style.display = 'none';
            return;
        }

        let html = `<table><tr><th>Rank</th><th>User</th><th>Score</th></tr>`;
        let rank = 1;

        query.forEach(doc => {
            const data = doc.data();
            const uname = data.username || 'Unknown';
            const isMe = uname === uniqueUsername(user);
            // Keep all rows in proper rank order, just highlight your row
            html += `<tr${isMe ? ' class="me"' : ''}><td>${rank}</td><td>${uname}</td><td>${data.score}</td></tr>`;
            rank++;
        });

        html += `</table>`;
        leaderboardDiv.innerHTML = html;
        profileMenu.style.display = 'none';
    } catch (error) {
        console.error("Error loading leaderboard:", error);
        leaderboardDiv.innerHTML = `<p style="color:var(--accent2)">Error loading leaderboard. Check connection.</p>`;
    }
}


// ----- SNAKE GAME LOGIC below -----
const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const box = 20; // cell size
let snake, direction, nextDirection, food, score, evo, evoActive, evoTimer, gameRunning, frameCount, moveDelay, animationId;
// 🎵 Preload sound for food consumption
const foodSound = new Audio('assets/food.mp3');

function playSound(effectName) {
    if (effectName === 'food') {
        foodSound.currentTime = 0; 
        foodSound.play().catch(err => console.log("Audio play error:", err));
    }
}

// For Powerup
let slowTime = null;
let slowTimeActive = false;
let slowTimeTimer = 0;
function initGameVars() {
    snake = [{ x: 10, y: 10 }];
    direction = { x: 0, y: 0 };
    nextDirection = { x: 0, y: 0 };
    food = randomTile();
    score = 0;
    evo = null;
    evoActive = false;
    evoTimer = 0;
    frameCount = 0;
    moveDelay = 9;
    document.getElementById('score').textContent = score;
    document.getElementById('evoBox').textContent = '';
}
let userBestScore = 0;

function randomTile() {
    return {
        x: Math.floor(Math.random() * canvas.width / box),
        y: Math.floor(Math.random() * canvas.height / box)
    };
}
function randomEmptyTile() {
    let pos;
    do { pos = randomTile(); }
    while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
    return pos;
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' && direction.x !== 1) nextDirection = { x: -1, y: 0 };
    if (e.key === 'ArrowUp' && direction.y !== 1) nextDirection = { x: 0, y: -1 };
    if (e.key === 'ArrowRight' && direction.x !== -1) nextDirection = { x: 1, y: 0 };
    if (e.key === 'ArrowDown' && direction.y !== -1) nextDirection = { x: 0, y: 1 };

    if ((direction.x === 0 && direction.y === 0) && (nextDirection.x !== 0 || nextDirection.y !== 0)) {
        direction = { ...nextDirection };
    }
    if (!gameRunning) { startBtn.click(); }
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'a' && direction.x !== 1) nextDirection = { x: -1, y: 0 };
    if (e.key === 'w' && direction.y !== 1) nextDirection = { x: 0, y: -1 };
    if (e.key === 'd' && direction.x !== -1) nextDirection = { x: 1, y: 0 };
    if (e.key === 's' && direction.y !== -1) nextDirection = { x: 0, y: 1 };

    if ((direction.x === 0 && direction.y === 0) && (nextDirection.x !== 0 || nextDirection.y !== 0)) {
        direction = { ...nextDirection };
    }
    if (!gameRunning) { startBtn.click(); }
});

let bestScore = Number(localStorage.getItem('snake_best') || 0);


//Scores functions 
function loadBestScore() {
    const user = auth.currentUser;
    console.log("this is user : ", user);
    if (!user) {
        bestScore = Number(localStorage.getItem('snake_best') || 0);
        document.getElementById('bestScoreBox').textContent = "Best Score: " + bestScore;
    } else {
        // fetch from firestore
        db.collection('scores').doc(user.uid).get().then(doc => {
            bestScore = (doc.exists && typeof doc.data().score === "number") ? doc.data().score : 0;
            document.getElementById('bestScoreBox').textContent = "Best Score: " + bestScore;
        }).catch(error => {
            console.error("Error loading best score:", error);
            bestScore = 0;
            document.getElementById('bestScoreBox').textContent = "Best Score: " + bestScore;
        });
    }
}


function saveScoreIfBest() {
    const user = auth.currentUser;
    console.log("this is user : ", user);
    if (!user) {
        if (score > bestScore) {
            localStorage.setItem('snake_best', score);
            bestScore = score;
        }
    } else {
        if (score > bestScore) {
            bestScore = score;
            db.collection('scores').doc(user.uid)
                .set({ username: uniqueUsername(user), score: bestScore });
        }
    }
    document.getElementById('bestScoreBox').textContent = "Best Score :" + bestScore;
}



function draw() {
    ctx.fillStyle = "#242140";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Food
    ctx.fillStyle = "#ffcb05";
    ctx.fillRect(food.x * box + 3, food.y * box + 3, box - 6, box - 6);
    // Evo powerup
    if (evo) {
        ctx.save();
        ctx.shadowColor = "#ff45a3";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "#ff45a3";
        ctx.beginPath();
        ctx.arc(evo.x * box + box / 2, evo.y * box + box / 2, box / 2 - 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.arc(evo.x * box + box / 2, evo.y * box + box / 2, box / 2 - 2, 0, 2 * Math.PI);
        ctx.stroke();
    }
    // Slowdown powerup
    if (slowTime) {
    ctx.save();
    ctx.shadowColor = "#8e44ad"; // purple glow
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#8e44ad"; // purple fill
    ctx.fillRect(slowTime.x * box + 4, slowTime.y * box + 4, box - 8, box - 8);
    ctx.restore();
    }

    // Snake
    for (let i = 0; i < snake.length; i++) {
        ctx.save();
        ctx.fillStyle = i === 0 ? "#ececec" : "url(#snake-gradient)";
        ctx.shadowColor = i === 0 ? "#39ff14" : "#181818";
        ctx.shadowBlur = i === 0 ? 16 : 3;
        ctx.fillRect(snake[i].x * box + 2, snake[i].y * box + 2, box - 4, box - 4);
        ctx.restore();
        // cute eye for head:
        if (i === 0) {
            ctx.fillStyle = "#2a2f36";
            ctx.beginPath();
            ctx.arc(snake[i].x * box + box * 0.7, snake[i].y * box + box * 0.45, 2.4, 0, 2 * Math.PI);
            ctx.fill();
        }
    }


    if (!gameRunning && (score > 0 || snake.length > 1)) {
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = "#19172d";
        ctx.fillRect(0, 160, canvas.width, 80);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ff45a3";
        ctx.font = "bold 34px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, 200);
        ctx.font = "22px Arial";
        ctx.fillStyle = "white";
        ctx.fillText("Score: " + score, canvas.width / 2, 228);
        ctx.fillStyle = "#39ff14";
        ctx.textAlign = "center";
        ctx.font = "16px Arial";
        ctx.fillText("Best: " + bestScore, canvas.width / 2, 250);
        ctx.restore();
    }

}
function update() {
    if (direction.x === 0 && direction.y === 0) return;
    direction = nextDirection;
    let head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };
    // Wall collision unless evoActive
    if (!evoActive &&
        (head.x < 0 || head.x >= canvas.width / box || head.y < 0 || head.y >= canvas.height / box))
        return gameOver();
    if (evoActive) {
        head.x = (head.x + canvas.width / box) % (canvas.width / box);
        head.y = (head.y + canvas.height / box) % (canvas.height / box);
        evoTimer--;
        if (evoTimer <= 0) {
            evoActive = false;
            document.getElementById('evoBox').textContent = '';
        }
    }
    // Self collision
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) return gameOver();
    snake.unshift(head);
    // Eat food
    if (head.x === food.x && head.y === food.y) {
        score++;
        document.getElementById('score').textContent = score;
        food = randomEmptyTile();
        playSound('food');
        if (!evo && Math.random() < 0.22) evo = randomEmptyTile();
        if (!slowTime && Math.random() < 0.18) slowTime = randomEmptyTile();
    } else if (evo && head.x === evo.x && head.y === evo.y) {
        evoActive = true;
        evoTimer = 44;
        document.getElementById('evoBox').textContent = 'WALL PASS ACTIVE!';
        evo = null;
    }
    else if (slowTime && head.x === slowTime.x && head.y === slowTime.y) {
    slowTimeActive = true;
    slowTimeTimer = 300; // lasts ~5 seconds at 60fps
    moveDelay = 12; // slow down movement
    slowTime = null; // remove powerup from board
    document.getElementById('evoBox').textContent = 'SLOW TIME ACTIVE!';
    } else {
        snake.pop();
    }
}

function gameOver() {
    gameRunning = false;
    document.body.classList.remove('game-active');
    saveScoreIfBest();
    slowTime = null;
    draw(); // to show game over overlay
}

function loop() {
    animationId = requestAnimationFrame(loop);
    if (!gameRunning) return;
    // ⏳ Handle Slow Time countdown
    if (slowTimeActive) {
        slowTimeTimer--;
        if (slowTimeTimer <= 0) {
            slowTimeActive = false;
            moveDelay = 6; // restore normal speed
            document.getElementById('evoBox').textContent = '';
        }
    }
    frameCount++;
    if (frameCount >= moveDelay) {
        frameCount = 0;
        update();
    }

    draw();
}

function resetGame() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    initGameVars();
    draw();
}

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

// --- Add button click sound ---
const clickSound = new Audio('images/click.wav');

[startBtn, pauseBtn, resetBtn].forEach(btn => {
  btn.addEventListener('click', () => {
    clickSound.currentTime = 0;
    clickSound.play();
  });
});



startBtn.onclick = () => {
    if (!gameRunning) {
        if (snake.length > 1 || score > 0 || direction.x !== 0 || direction.y !== 0) {
            resetGame();
        }
        gameRunning = true;
        pauseBtn.textContent = 'Pause';
        pauseBtn.disabled = false;
        resetBtn.disabled = false;
        document.body.classList.add('game-active'); // Prevent page scroll
        if (!animationId) loop();
    }
};
pauseBtn.onclick = () => {
    if (gameRunning) {
        gameRunning = false;
        pauseBtn.textContent = 'Resume';
        document.body.classList.remove('game-active');
        pauseOverlay.classList.add('show');
    } else {
        gameRunning = true;
        pauseBtn.textContent = 'Pause';
        document.body.classList.add('game-active');
        pauseOverlay.classList.remove('show');
        if (!animationId) loop();
    }
};
resetBtn.onclick = () => {
    gameRunning = false;
    pauseBtn.textContent = 'Pause';
    pauseBtn.disabled = true;
    resetBtn.disabled = true;
    resetGame();
};



window.onload = function () {
    // profileToggle.style.display = 'none';
    pauseBtn.disabled = true;
    resetBtn.disabled = true;
    leaderboardSection.style.display = "none";
    loadBestScore();
    initGameVars();
    draw();
};
