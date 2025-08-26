/* ---------- Utility & state ---------- */
const preview1 = document.getElementById('preview1');
const preview2 = document.getElementById('preview2');
const singleBtn = document.getElementById('singleBtn');
const multiBtn = document.getElementById('multiBtn');
const prepBtn = document.getElementById('prepBtn');
const menu = document.getElementById('menu');
const playArea = document.getElementById('playArea');
const resultArea = document.getElementById('resultArea');
const modeLabel = document.getElementById('modeLabel');
const scoreLabel = document.getElementById('scoreLabel');
const displayWord = document.getElementById('displayWord');
const typeInput = document.getElementById('typeInput');
const enterBtn = document.getElementById('enterBtn');
const messageEl = document.getElementById('message');
const progressEl = document.getElementById('progress');
const backBtn = document.getElementById('backBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const resultText = document.getElementById('resultText');
const scoreboard = document.getElementById("bestScore");
const provider = new firebase.auth.GoogleAuthProvider();



let allWords = [];
let wordlist1 = [];
let wordlist2 = [];

let mode = null; // 'single' or 'multi'
let currentIndex = 0;
let currentWord = '';
let wordStart = 0;
let scores = {player1:0, player2:0};
let playerTurn = 1;
let stage = 'menu'; // 'menu', 'playing', 'result'

let streaks = { player1: 0, player2: 0 };
let totalTyped = { player1: 0, player2: 0 };
let correctTyped = { player1: 0, player2: 0 };

let mistakesLog = [];


const firebaseConfig = {
  apiKey: "",
  authDomain: "typewars-27c83.firebaseapp.com",
  projectId: "typewars-27c83",
  storageBucket: "typewars-27c83.firebasestorage.app",
  messagingSenderId: "403823109053",
  appId: "1:403823109053:web:95e40e06e72549f1a9e8d4",
  measurementId: "G-4FQ9NFGW27"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Make auth and firestore available
const auth = firebase.auth();
const db = firebase.firestore();

/* ---------- fetch wordlist ---------- */
fetch('./wordlist.txt').then(r => {
  if (!r.ok) throw new Error('no file');
  return r.text();
}).then(txt => {
  allWords = txt.split(/\r?\n/).map(w=>w.trim()).filter(Boolean);
  prepareLists();
});

/* ---------- helpers ---------- */
function sample(list,count){
  const out=[];
  for(let i=0;i<count;i++){
    out.push(list[Math.floor(Math.random()*list.length)]);
  }
  return out;
}
function spaced(w){ return w.split('').join(' '); }

async function loadBestScore() {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const bestScore = userSnap.data().bestScore || 0;
    document.getElementById("bestScore").textContent = bestScore;
  } else {
    document.getElementById("bestScore").textContent = 0;
  }
}


function calculateScore(word, time) {
  const minutes = time / 60;
  const wpm = (word.length / 5) / minutes;
  const points = Math.min(200, Math.round(wpm * 2));

  return points;
}


function prepareLists(){
  if(!allWords.length) return;
  wordlist1 = sample(allWords,10);
  wordlist2 = sample(allWords,10);
  renderPreviews();
  message('Wordlists prepared.');
}
function renderPreviews(){
  preview1.innerHTML = '';
  preview2.innerHTML = '';
  wordlist1.forEach(w=>{ const li=document.createElement('li'); li.textContent=w; preview1.appendChild(li); });
  wordlist2.forEach(w=>{ const li=document.createElement('li'); li.textContent=w; preview2.appendChild(li); });
}

singleBtn.addEventListener('click', startSingle);
multiBtn.addEventListener('click', startMulti);
prepBtn.addEventListener('click', () => { prepareLists(); });

function startSingle(){
  if(!wordlist1.length) prepareLists();
  mode='single';
  stage='playing';
  currentIndex=0;
  scores={player1:0,player2:0};
  streaks={player1:0,player2:0};
  totalTyped={player1:0,player2:0};
  correctTyped={player1:0,player2:0};
  playerTurn=1;
  modeLabel.textContent='Single Player';
  showPlayArea();
  beginWordForIndex(0, wordlist1);
}

function startMulti(){
  if(!wordlist1.length) prepareLists();
  mode='multi';
  stage='playing';
  currentIndex=0;
  scores={player1:0,player2:0};
  streaks={player1:0,player2:0};
  totalTyped={player1:0,player2:0};
  correctTyped={player1:0,player2:0};
  playerTurn=1;
  modeLabel.textContent='Multiplayer — Player 1';
  showPlayArea();
  beginWordForIndex(0, wordlist1);
}

function showPlayArea(){
  menu.classList.add('fade-out');
  resultArea.classList.add('fade-out');
  setTimeout(() => {
    menu.classList.add('hidden');
    resultArea.classList.add('hidden');
    playArea.classList.remove('hidden');
    playArea.classList.add('fade-in');
  }, 300);
}


function showMenu(){
  playArea.classList.add('fade-out');
  resultArea.classList.add('fade-out');
  setTimeout(() => {
    playArea.classList.add('hidden');
    resultArea.classList.add('hidden');
    menu.classList.remove('hidden');
    menu.classList.add('fade-in');
  }, 300);
}


async function showResult() {
  try {
    const resultArea = document.getElementById("resultArea");
    const resultText = document.getElementById("resultText");
    if (!resultArea || !resultText) {
      console.error("❌ Missing resultArea or resultText in DOM");
      return;
    }

    const res = await fetch("/analyze-mistakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mistakesLog })
    });

    const data = await res.json();
    console.log("✅ Server responded:", data);

    const analysis = data.analysis || "Tutor unavailable. Keep practicing!";

    // Display final stats
    resultText.innerHTML = `WPM: ${finalWpm} | Accuracy: ${finalAccuracy}%`;

    // Clear old AI feedback if any
    resultArea.querySelectorAll(".ai-feedback").forEach(el => el.remove());

    // Add AI feedback
    const feedbackDiv = document.createElement("div");
    feedbackDiv.classList.add("ai-feedback");
    feedbackDiv.style.marginTop = "12px";
    feedbackDiv.innerText = analysis;
    resultArea.appendChild(feedbackDiv);

    resultArea.classList.remove("hidden");

    // Reset mistakes log for next game
    mistakesLog = [];
  } catch (err) {
    console.error("showResult error:", err);
    resultText.innerText = "Error showing results. Tutor feedback unavailable.";
  }
}

/* ---------- word handling ---------- */
function beginWordForIndex(index, listInUse){
  currentIndex = index;
  currentWord = listInUse[index];
  displayWord.textContent = currentWord ? spaced(currentWord) : '—';
  typeInput.value = '';
  wordStart = Date.now();
  progressEl.textContent = `${currentIndex+1} / 10`;
  typeInput.focus();
}

document.getElementById('typeForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  handleSubmit();
});

enterBtn.addEventListener('click',(e)=>{
  e.preventDefault();
  handleSubmit();
});

const authArea = document.getElementById('authArea');
const logoutBtn = document.getElementById('logoutBtn');

// Google Login
document.getElementById("googleLoginBtn").addEventListener("click", () => {
  auth.signInWithPopup(provider)
    .then(result => {
      const user = result.user;

      // Animate login panel fade out
      authArea.classList.add('fade-out');
      setTimeout(() => {
        authArea.classList.add('hidden');
        menu.classList.remove('hidden');
        menu.classList.add('fade-in');
      }, 500);

      message(`Welcome ${user.displayName}!`);
    })
    .catch(err => {
      console.error("Login failed:", err);
      alert("Google login failed: " + err.message);
    });
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  auth.signOut().then(() => {
    message("Logged out successfully!");
  });
});

// Monitor login state
auth.onAuthStateChanged(async (user) => {
  if (user) {
    authArea.classList.add('hidden');
    menu.classList.remove('hidden');
    scoreboard.classList.remove('hidden');   // show scoreboard

    try {
      const snap = await db.collection("scores").doc(user.uid).get();
      if (snap.exists) {
        const best = snap.data().best;
        document.getElementById("bestScore").textContent = best;
        message(`Welcome back! Best score: ${best}`);
      } else {
        document.getElementById("bestScore").textContent = "No score yet";
        message("Welcome! Let's set a high score.");
      }
    } catch (err) {
      console.warn("Could not load score", err);
    }
  } else {
    authArea.classList.remove('hidden');
    menu.classList.add('hidden');
    playArea.classList.add('hidden');
    resultArea.classList.add('hidden');
    scoreboard.classList.add('hidden');   // hide scoreboard
  }
});


async function saveScore(score) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await db.collection("scores")
      .doc(user.uid)
      .collection("history")
      .add({
        score,
        playedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    const ref = db.collection("scores").doc(user.uid);
    const prev = await ref.get();
    const best = prev.exists ? Math.max(prev.data().best || 0, score) : score;

    await ref.set({
      best,
      lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

  } catch (err) {
    console.error("Error saving score", err);
  }
}

let finalWpm = 0;
let finalAccuracy = 0;

function updateStats(){
  const playerKey = mode === 'single' ? 'player1' : `player${playerTurn}`;
  const elapsedMin = (Date.now() - wordStart) / 60000;
  const wpm = elapsedMin > 0 ? Math.round((currentWord.length / 5) / elapsedMin) : 0;

  document.getElementById("wpmLabel").textContent = wpm;
  document.getElementById("accuracyLabel").textContent = getAccuracy(playerKey) + '%';

  // 🔹 Save for final results
  finalWpm = wpm;
  finalAccuracy = getAccuracy(playerKey);
}


function handleSubmit(){
  if(!currentWord) return;

  // Determine which player is typing
  const playerKey = mode === 'single' ? 'player1' : `player${playerTurn}`;
  const user = typeInput.value.trim();
  totalTyped[playerKey]++;

  // Highlight mistyped letters
  displayWord.innerHTML = getHighlightedWord(currentWord, user);

    if(user !== currentWord){
      streaks[playerKey] = 0; // reset streak
      scores[playerKey] -= 10;
      updateScore();
      updateStats();
      message(mode === 'single' 
        ? `Incorrect! -10 points. Accuracy: ${getAccuracy(playerKey)}%`
        : `Player ${playerTurn} Incorrect! -10 points. Accuracy: ${getAccuracy(playerKey)}%`
      );

      if(user !== currentWord){
    streaks[playerKey] = 0;
    scores[playerKey] -= 10;
    updateScore();
    updateStats();

    // Detect mistyped letters
    const wrongLetters = [];
    const minLen = Math.min(user.length, currentWord.length);
    for(let i=0; i<minLen; i++){
      if(user[i] !== currentWord[i]) wrongLetters.push(currentWord[i]);
    }
    if(user.length < currentWord.length){
      wrongLetters.push(...currentWord.slice(user.length).split(''));
    }

    mistakesLog.push({ 
      word: currentWord, 
      typed: user, 
      wrongLetters, 
      player: playerKey 
    });


    message(`Incorrect! -10 points. Accuracy: ${getAccuracy(playerKey)}%`);
    return;
  }


    return;
  }

  // Correct word
  correctTyped[playerKey]++;
  streaks[playerKey]++;
  let bonus = 0;
  if(streaks[playerKey] > 1 && streaks[playerKey] % 5 === 0){
    bonus = 20; // streak bonus
    message(`Player ${playerTurn} +${bonus} streak bonus!`);
  }

  const elapsed = (Date.now() - wordStart)/1000;
  const pts = calculateScore(currentWord, elapsed) + bonus;
  scores[playerKey] += pts;
  updateScore();
  updateStats();
  message(mode === 'single' 
    ? `+${pts} points! Accuracy: ${getAccuracy(playerKey)}%`
    : `Player ${playerTurn} +${pts} points! Accuracy: ${getAccuracy(playerKey)}%`
  );

  // Move to next word or next player
  if(mode === 'single'){
    if(currentIndex + 1 < wordlist1.length){
      beginWordForIndex(currentIndex + 1, wordlist1);
    } else {
      stage = 'result';
      resultText.innerHTML = `You scored <strong class="score">${scores.player1}</strong> points.<br>Accuracy: ${getAccuracy('player1')}%`;
      showResult();
      saveScore(scores.player1);
      document.getElementById("bestScore").textContent = Math.max(
        parseInt(document.getElementById("bestScore").textContent || 0),
        scores.player1
      );
    }
  } else {
    // Multiplayer logic (Player 1 → Player 2)
    if(playerTurn === 1){
      if(currentIndex + 1 < wordlist1.length){
        beginWordForIndex(currentIndex + 1, wordlist1);
      } else {
        message('Player 1 finished. Player 2 will start in 10 seconds...');
        modeLabel.textContent = 'Multiplayer — break';
        let countdown = 10;
        const cnt = setInterval(()=> {
          message(`Player 2 starts in ${countdown} seconds...`);
          countdown--;
          if(countdown < 0){
            clearInterval(cnt);
          }
        },1000);
        setTimeout(()=> {
          playerTurn = 2;
          modeLabel.textContent = 'Multiplayer — Player 2';
          beginWordForIndex(0, wordlist2);
          message('Player 2 go!');
        }, 10000);
      }
    } else {
      // Player 2 turn
      if(currentIndex + 1 < wordlist2.length){
        beginWordForIndex(currentIndex + 1, wordlist2);
      } else {
        stage='result';
        let winner;
        if(scores.player1 > scores.player2) winner = 'Player 1 won!';
        else if(scores.player2 > scores.player1) winner = 'Player 2 won!';
        else winner = "It's a tie!";
        resultText.innerHTML = `Player 1: <strong class="score">${scores.player1}</strong><br/>Accuracy: ${getAccuracy('player1')}%<br/>Player 2: <strong class="score">${scores.player2}</strong><br/>Accuracy: ${getAccuracy('player2')}%<br/><br/><strong>${winner}</strong>`;
        showResult();
        saveScore(Math.max(scores.player1, scores.player2));
        document.getElementById("bestScore").textContent = Math.max(
          parseInt(document.getElementById("bestScore").textContent || 0),
          Math.max(scores.player1, scores.player2)
        );
      }
    }
  }
}

async function analyzeMistakes(playerKey){

  const res = await fetch("/analyze-mistakes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mistakesLog })
});

}

function getAccuracy(playerKey){
  if(totalTyped[playerKey] === 0) return 100;
  return Math.round((correctTyped[playerKey] / totalTyped[playerKey]) * 100);
}

function getHighlightedWord(word, typed){
  let result = '';
  for(let i=0; i<word.length; i++){
    if(typed[i] === word[i]) result += `<span style="color:black">${word[i]}</span> `;
    else result += `<span style="color:red">${word[i]}</span> `;
  }
  return result;
}

function beginWordForIndex(index, listInUse){
  currentIndex = index;
  currentWord = listInUse[index];
  displayWord.innerHTML = spaced(currentWord); // reset highlights
  typeInput.value = '';
  wordStart = Date.now();
  progressEl.textContent = `${currentIndex+1} / 10`;
  typeInput.focus();
}


function updateScore(){
  if(mode === 'single') scoreLabel.textContent = scores.player1;
  else scoreLabel.textContent = `P1: ${scores.player1} • P2: ${scores.player2}`;
}
function message(txt){ messageEl.textContent = txt; }


backBtn.addEventListener('click', ()=>{
  // reset minimal state
  mode=null; stage='menu'; scores={player1:0,player2:0}; playerTurn=1; currentIndex=0;
  displayWord.textContent = '—';
  updateScore();
  showMenu();
});
playAgainBtn.addEventListener('click', ()=>{
  if(mode === 'single') startSingle();
  else if(mode === 'multi') startMulti();
  else showMenu();
});


showMenu();
