// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let gamePaused = false;
let dropMaker; // Will store our timer that creates drops regularly
let timerInterval;
const GAME_DURATION = 30;
let timeLeft = GAME_DURATION;
const DEFAULT_DIFFICULTY = "Easy";
const DIFFICULTY_SETTINGS = {
  Easy: {
    cleanDropChance: 0.75,
    fakeDropChance: 0,
    fallDurationSeconds: 3.8,
    windPxPerFrame: 0,
  },
  Medium: {
    cleanDropChance: 0.7,
    fakeDropChance: 0.2,
    fallDurationSeconds: 4.4,
    windPxPerFrame: 0,
  },
  Hard: {
    cleanDropChance: 0.66,
    fakeDropChance: 0.24,
    fallDurationSeconds: 4,
    windPxPerFrame: 0.55,
  },
  Expert: {
    cleanDropChance: 0.62,
    fakeDropChance: 0.28,
    fallDurationSeconds: 3.3,
    windPxPerFrame: 0.9,
  },
};
const FAKE_DROP_FLIP_DELAY_MS = 900;
const FAKE_DROP_WARNING_MS = 600;
const FAKE_DROP_WARNING_DISTANCE_PX = 170;
const FAKE_DROP_FLIP_DISTANCE_PX = 95;
const DEFAULT_MASTER_VOLUME = 0.7;
const BACKGROUND_MUSIC_VOLUME = 0.55;
const WINNER_SOUND_VOLUME = 0.9;
const WIND_AMBIENCE_VOLUME = 0.35;
const WIND_AMBIENCE_LEVELS = new Set(["Hard", "Expert"]);
const SPLASH_VOICES_PER_SOUND = 3;
const SPLASH_SOUND_PATHS = [
  "audio/bbc_water---la_07044109.mp3",
  "audio/bbc_water---sm_07044110.mp3",
  "audio/universfield-water-splash-199583.mp3",
  "audio/dragon-studio-water-splash-effect-443133.mp3",
];
const SCORE_PER_CLEAN_DROP = 10;
const SCORE_PER_DIRTY_DROP = -10;
const MAX_WATER_SCORE = 100; // 10 clean drops fills the bar
let currentScore = 0;
let waterCollected = 0;
const waterBarFill = document.getElementById("score-bar");
const catcher = document.querySelector(".catcher");
const bucket = document.querySelector(".bucket");
const grass = document.querySelector(".grass");
const sunray = document.querySelector(".sunray");
const gameContainer = document.getElementById("game-container");
const clouds = Array.from(document.querySelectorAll(".cloud"));
const catcherNav = document.getElementById("catcher-nav");
const scoreElement = document.getElementById("score");
const timeElement = document.getElementById("time");
const volumeSlider = document.getElementById("audio-volume");
const muteButton = document.getElementById("mute-btn");
const rulesSectionElement = document.getElementById("rules-section");
const gameBackgroundSectionElement = document.getElementById("game-background-section");
const currentLevelElement = document.getElementById("current-level");
const difficultyOptions = Array.from(document.querySelectorAll(".difficulty-option"));
const backgroundMusic = document.getElementById("background-music");
const windSound = document.getElementById("wind-sound");
const winnerSound = document.getElementById("winner-sound");
const splashSoundPool = SPLASH_SOUND_PATHS.flatMap((path) =>
  Array.from({ length: SPLASH_VOICES_PER_SOUND }, () => {
    const audio = new Audio(path);
    audio.preload = "auto";
    return audio;
  })
);
let splashSoundIndex = 0;
let masterVolume = DEFAULT_MASTER_VOLUME;
let isAudioMuted = false;
let rulesExpanded = true;
let currentDifficulty = DEFAULT_DIFFICULTY;
const CONFETTI_COLORS = [
  "#FFC907",
  "#2E9DF7",
  "#8BD1CB",
  "#4FCB53",
  "#FF902A",
  "#F5402C",
  "#F16061",
  "#A66CFF",
  "#FF5CA2",
  "#3ADDD8",
  "#FFB347",
  "#FF6961",
];

const gameBackground = ["Charity: Water's work is driven by a belief that clean water is more than a basic need, it iss the foundation for health, education, dignity, and opportunity. This game reflects that passion by turning their mission into an experience players can feel and participate in. Every clean drop collected and every challenge completed in a game symbolize the real struggles communities face and the lope that clean water brings. Through the game, players are not just moving a character on a screen, they are stepping into a story about resilience, possibility, and the power of small actions that add up to meaningful change. The game becomes an interactive doorway into understanding why clean water matters and how collective effort can transform lives. If you would like to donate to help provide clean water to those in need, please visit Charity: Water's website at https://www.charitywater.org/donate."];

var gameLevels = ["Easy", "Medium", "Hard", "Expert"];

function getDifficultySettings() {
  return DIFFICULTY_SETTINGS[currentDifficulty] || DIFFICULTY_SETTINGS[DEFAULT_DIFFICULTY];
}

function setDifficulty(level) {
  if (!DIFFICULTY_SETTINGS[level]) return;

  currentDifficulty = level;

  if (currentLevelElement) {
    currentLevelElement.textContent = level;
  }

  difficultyOptions.forEach((option) => {
    const isActive = option.dataset.level === level;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-current", isActive ? "true" : "false");
  });

  syncWindAmbience();
}

function getEffectiveMasterVolume() {
  return isAudioMuted ? 0 : masterVolume;
}

function applyAudioSettings() {
  const effectiveVolume = getEffectiveMasterVolume();

  if (backgroundMusic) {
    backgroundMusic.volume = BACKGROUND_MUSIC_VOLUME * effectiveVolume;
  }

  if (windSound) {
    windSound.volume = WIND_AMBIENCE_VOLUME * effectiveVolume;
  }

  if (winnerSound) {
    winnerSound.volume = WINNER_SOUND_VOLUME * effectiveVolume;
  }

  if (muteButton) {
    muteButton.textContent = isAudioMuted ? "Unmute" : "Mute";
    muteButton.setAttribute("aria-pressed", String(isAudioMuted));
  }

  if (volumeSlider) {
    volumeSlider.value = String(Math.round(masterVolume * 100));
  }
}

function handleVolumeChange(event) {
  const sliderValue = Number(event.target.value);
  const normalized = Number.isFinite(sliderValue) ? sliderValue / 100 : DEFAULT_MASTER_VOLUME;
  masterVolume = Math.max(0, Math.min(1, normalized));
  isAudioMuted = masterVolume === 0;
  applyAudioSettings();
}

function toggleMute() {
  isAudioMuted = !isAudioMuted;
  applyAudioSettings();
}

function playManagedAudio(audioElement, restart = false) {
  if (!audioElement) return;

  if (restart) {
    audioElement.currentTime = 0;
  }

  const playPromise = audioElement.play();
  if (!playPromise || typeof playPromise.catch !== "function") {
    return;
  }

  playPromise.catch(() => {
    const retryWhenReady = () => {
      audioElement.play().catch(() => {});
    };

    audioElement.addEventListener("canplay", retryWhenReady, { once: true });
    audioElement.load();
  });
}

difficultyOptions.forEach((option) => {
  option.addEventListener("click", (event) => {
    event.preventDefault();
    setDifficulty(option.dataset.level);
  });
});

setDifficulty(DEFAULT_DIFFICULTY);

let blueCleanCount = 0;
let greenPollutedCount = 0;
let brownPollutedCount = 0;

function renderDropColorCounts() {
  const blueCountElement = document.getElementById("blue-clean-count");
  const greenCountElement = document.getElementById("green-polluted-count");
  const brownCountElement = document.getElementById("brown-toxic-count");

  if (blueCountElement) {
    blueCountElement.textContent = blueCleanCount;
  }

  if (greenCountElement) {
    greenCountElement.textContent = greenPollutedCount;
  }

  if (brownCountElement) {
    brownCountElement.textContent = brownPollutedCount;
  }
}

function resetDropColorCounts() {
  blueCleanCount = 0;
  greenPollutedCount = 0;
  brownPollutedCount = 0;
  renderDropColorCounts();

  const tracker = document.getElementById("water-drop-color-tracker");
  if (tracker) {
    tracker.textContent = "No drops caught yet.";
  }
}

function WaterDropColorTracker(drop) {
  const tracker = document.getElementById("water-drop-color-tracker");

  if (drop.classList.contains("clean-water-drop")) {
    blueCleanCount++;
    if (tracker) {
      tracker.textContent = `Number of blue clean drops caught: ${blueCleanCount}`;
    }
  } else if (drop.classList.contains("dirty-water-drop-green")) {
    greenPollutedCount++;
    if (tracker) {
      tracker.textContent = `Number of green polluted drops caught: ${greenPollutedCount}`;
    }
  } else if (drop.classList.contains("dirty-water-drop-brown")) {
    brownPollutedCount++;
    if (tracker) {
      tracker.textContent = `Number of brown toxic drops caught: ${brownPollutedCount}`;
    }
  }

  renderDropColorCounts();
}

function WaterDropTypeTracker(isFake) {
  const tracker = document.getElementById("water-drop-type-tracker");
  if (tracker) {
    tracker.textContent = `Last drop type: ${isFake ? "Fake" : "Real"}`;
  }
}

resetDropColorCounts();

function updateCatcherPosition(positionPercent) {
  catcher.style.left = `${positionPercent}%`;
}

function getRandomDropType() {
  if (Math.random() < getDifficultySettings().cleanDropChance) {
    return "clean-water-drop";
  }

  return Math.random() < 0.5
    ? "dirty-water-drop-green"
    : "dirty-water-drop-brown";
}

function isFake() {
  return Math.random() < getDifficultySettings().fakeDropChance;
}

function renderGameBackground() {
  const target = gameBackgroundSectionElement || document.getElementById("game-background-section");
  if (!target || gameBackground.length === 0) return;

  const paragraph = document.createElement("p");
  paragraph.textContent = gameBackground[0];
  target.replaceChildren(paragraph);
}

function shouldPlayWindAmbience() {
  return gameRunning && WIND_AMBIENCE_LEVELS.has(currentDifficulty);
}

function syncWindAmbience() {
  if (!windSound) return;

  if (shouldPlayWindAmbience()) {
    playManagedAudio(windSound);
    return;
  }

  windSound.pause();
  windSound.currentTime = 0;
}

function playRandomSplashSound() {
  if (splashSoundPool.length === 0) return;

  // Round-robin through preloaded channels to avoid dropped sounds
  // when multiple splashes happen close together.
  const sound = splashSoundPool[splashSoundIndex % splashSoundPool.length];
  splashSoundIndex++;

  sound.currentTime = 0;
  sound.volume = (0.32 + Math.random() * 0.26) * getEffectiveMasterVolume();
  sound.playbackRate = 0.92 + Math.random() * 0.16;
  playManagedAudio(sound);
}



function updateScoreDisplay() {
  scoreElement.textContent = currentScore;
}

function getDropScore(drop) {
  if (drop.classList.contains("clean-water-drop")) {
    return SCORE_PER_CLEAN_DROP;
  }

  return SCORE_PER_DIRTY_DROP;
}

function intersects(rectA, rectB) {
  return !(
    rectA.right < rectB.left ||
    rectA.left > rectB.right ||
    rectA.bottom < rectB.top ||
    rectA.top > rectB.bottom
  );
}

function getDropStartX(size) {
  const fallbackX = Math.random() * (gameContainer.offsetWidth - size);

  if (clouds.length === 0) {
    return fallbackX;
  }

  const cloud = clouds[Math.floor(Math.random() * clouds.length)];
  const cloudRect = cloud.getBoundingClientRect();
  const containerRect = gameContainer.getBoundingClientRect();
  const cloudCenterX = cloudRect.left - containerRect.left + cloudRect.width / 2;
  const jitter = (Math.random() - 0.5) * Math.min(cloudRect.width * 0.6, 34);
  const left = cloudCenterX + jitter - size / 2;

  return Math.max(0, Math.min(left, gameContainer.offsetWidth - size));
}

function parseFontCandidates(fontFamilyValue) {
  if (!fontFamilyValue) return [];

  return fontFamilyValue
    .split(",")
    .map((name) => name.trim().replace(/^['\"]|['\"]$/g, ""))
    .filter(Boolean);
}

function detectLikelyRenderedFont(fontFamilyValue) {
  const candidates = parseFontCandidates(fontFamilyValue);
  const genericFamilies = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
  ]);

  for (const family of candidates) {
    if (genericFamilies.has(family.toLowerCase())) {
      continue;
    }

    if (document.fonts && document.fonts.check(`16px \"${family}\"`)) {
      return family;
    }
  }

  return candidates[candidates.length - 1] || "unknown";
}

function reportRenderedFont() {
  const timerLabel = document.querySelector(".timer");
  const scoreLabel = document.querySelector(".score");
  const debugElement = document.getElementById("font-debug");
  const target = timerLabel || scoreLabel;
  if (!target) return;

  const computedFontStack = window.getComputedStyle(target).fontFamily;
  const likelyRenderedFont = detectLikelyRenderedFont(computedFontStack);
  const message = `Rendered UI font (Score/Time): ${likelyRenderedFont} | Stack: ${computedFontStack}`;

  if (debugElement) {
    debugElement.textContent = message;
  }

  console.info(message);
}

// Wait for button click to start the game
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("pause-btn").addEventListener("click", pauseGame);
document.getElementById("resume-btn").addEventListener("click", resumeGame);
document.getElementById("restart-btn").addEventListener("click", restartGame);
document.getElementById("end-btn").addEventListener("click", endGameAndReset);
catcherNav.addEventListener("input", (event) => {
  updateCatcherPosition(event.target.value);
});
if (volumeSlider) {
  volumeSlider.addEventListener("input", handleVolumeChange);
}
if (muteButton) {
  muteButton.addEventListener("click", toggleMute);
}

[backgroundMusic, windSound, winnerSound].forEach((audioElement) => {
  if (!audioElement) return;
  audioElement.preload = "auto";
  audioElement.load();
});

splashSoundPool.forEach((audioElement) => {
  audioElement.load();
});

updateCatcherPosition(catcherNav.value);
RulesSection();
renderGameBackground();
applyAudioSettings();
reportRenderedFont();

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(reportRenderedFont);
}

function showPauseOverlay() {
  document.getElementById("pause-overlay").hidden = false;
}

function hidePauseOverlay() {
  document.getElementById("pause-overlay").hidden = true;
}

function triggerConfetti() {
  const existingLayer = gameContainer.querySelector(".celebration-confetti");
  if (existingLayer) {
    existingLayer.remove();
  }

  const confettiLayer = document.createElement("div");
  confettiLayer.className = "celebration-confetti";
  confettiLayer.style.setProperty(
    "--confetti-fall-distance",
    `${gameContainer.clientHeight + 40}px`
  );

  const pieceCount = 80;

  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor =
      CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.setProperty("--confetti-drift", `${(Math.random() - 0.5) * 220}px`);
    piece.style.setProperty("--confetti-rotate", `${Math.random() * 1080 - 540}deg`);
    piece.style.setProperty("--confetti-duration", `${1.8 + Math.random() * 1.2}s`);
    piece.style.setProperty("--confetti-delay", `${Math.random() * 0.35}s`);
    confettiLayer.appendChild(piece);
  }

  gameContainer.appendChild(confettiLayer);
  setTimeout(() => confettiLayer.remove(), 3200);
}

function displayMessage(text, duration) {
  const messageElement = document.createElement("div");
  messageElement.textContent = text;
  messageElement.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px 40px;
    border-radius: 8px;
    font-size: 24px;
    font-weight: bold;
    z-index: 1000;
  `;
  document.body.appendChild(messageElement);
  setTimeout(() => messageElement.remove(), duration);
}

function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    timeElement.textContent = timeLeft;
    if(timeLeft === 10) {
      displayMessage("10 seconds left! Keep going!", 2000);
    }
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function toggleRulesSection() {
  rulesExpanded = !rulesExpanded;
  RulesSection();
}

function RulesSection() {
  const target = rulesSectionElement || document.querySelector(".rules-section");
  if (!target) return;

  const rules = [
    "Catch blue clean-water drops to earn +10 points.",
    "Green or brown dirty drops cost 10 points if caught.",
    "Easy has no fake blue drops; Medium, Hard, and Expert include fakes.",
    "Hard and Expert add wind that pushes drops left and right.",
    "Each clean drop fills the water bar; dirty drops reduce it.",
    "Hard and Expert drops fall faster, so react quickly.",
    "Use Pause, Resume, or Restart anytime during gameplay.",
  ];

  const header = document.createElement("div");
  header.className = "rules-header";

  const heading = document.createElement("h2");
  heading.className = "rules-title";
  heading.textContent = "How to Play";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "rules-toggle-btn";
  toggleButton.textContent = rulesExpanded ? "Hide Rules" : "Show Rules";
  toggleButton.setAttribute("aria-expanded", String(rulesExpanded));
  toggleButton.addEventListener("click", toggleRulesSection);

  header.append(heading, toggleButton);

  const list = document.createElement("ol");
  list.className = "rules-list";

  rules.forEach((ruleText) => {
    const item = document.createElement("li");
    item.textContent = ruleText;
    list.appendChild(item);
  });

  const content = document.createElement("div");
  content.className = "rules-content";
  content.hidden = !rulesExpanded;
  content.appendChild(list);

  target.replaceChildren(header, content);
}

function endGame() {
  gameRunning = false;
  gamePaused = false;
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  backgroundMusic.pause();
  syncWindAmbience();
  document
    .querySelectorAll(".clean-water-drop, .dirty-water-drop-green, .dirty-water-drop-brown")
    .forEach((drop) => drop.remove());
  hidePauseOverlay();
  document.getElementById("pause-btn").hidden = true;
  triggerConfetti();
  playManagedAudio(winnerSound, true);
  setTimeout(() => {
    alert(`Game Over! Your final score is: ${currentScore}`);
    timeLeft = GAME_DURATION;
    timeElement.textContent = GAME_DURATION;
  }, 1100);
}

function pauseGame() {
  if (!gameRunning) return;
  gameRunning = false;
  gamePaused = true;
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  backgroundMusic.pause();
  syncWindAmbience();
  document
    .querySelectorAll(".clean-water-drop, .dirty-water-drop-green, .dirty-water-drop-brown")
    .forEach((d) => (d.style.animationPlayState = "paused"));
  showPauseOverlay();
}

function resumeGame() {
  gamePaused = false;
  gameRunning = true;
  playManagedAudio(backgroundMusic);
  syncWindAmbience();
  document
    .querySelectorAll(".clean-water-drop, .dirty-water-drop-green, .dirty-water-drop-brown")
    .forEach((d) => (d.style.animationPlayState = "running"));
  startTimer();
  dropMaker = setInterval(createDrop, 1000);
  hidePauseOverlay();
}

function restartGame() {
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  gamePaused = false;
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  syncWindAmbience();
  document
    .querySelectorAll(".clean-water-drop, .dirty-water-drop-green, .dirty-water-drop-brown")
    .forEach((drop) => drop.remove());
  hidePauseOverlay();
  currentScore = 0;
  waterCollected = 0;
  resetDropColorCounts();
  updateScoreDisplay();
  updateWaterBar();
  timeLeft = GAME_DURATION;
  timeElement.textContent = GAME_DURATION;
  gameRunning = true;
  playManagedAudio(backgroundMusic);
  syncWindAmbience();
  startTimer();
  dropMaker = setInterval(createDrop, 1000);
}

function endGameAndReset() {
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  gameRunning = false;
  gamePaused = false;
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  syncWindAmbience();
  document
    .querySelectorAll(".clean-water-drop, .dirty-water-drop-green, .dirty-water-drop-brown")
    .forEach((drop) => drop.remove());
  hidePauseOverlay();
  document.getElementById("pause-btn").hidden = true;
  currentScore = 0;
  waterCollected = 0;
  resetDropColorCounts();
  updateScoreDisplay();
  updateWaterBar();
  timeLeft = GAME_DURATION;
  timeElement.textContent = GAME_DURATION;
}

function startGame() {
  // Prevent multiple games from running at once
  if (gameRunning || gamePaused) return;

  gameRunning = true;
  currentScore = 0;
  waterCollected = 0;
  resetDropColorCounts();
  updateWaterBar();
  updateScoreDisplay();
  timeLeft = GAME_DURATION;
  timeElement.textContent = timeLeft;
  document.getElementById("pause-btn").hidden = false;

  playManagedAudio(backgroundMusic, true);
  syncWindAmbience();
  startTimer();

  // Create new drops every second (1000 milliseconds)
  dropMaker = setInterval(createDrop, 1000);
}

function createDrop() {
  const difficultySettings = getDifficultySettings();

  // Create a new div element that will be our water drop
  const drop = document.createElement("div");
  drop.className = getRandomDropType();
  const fakeDrop = drop.classList.contains("clean-water-drop") && isFake();

  if (fakeDrop) {
    drop.classList.add("fake-drop");
  }

  // Make drops different sizes for visual variety
  const initialSize = 60;
  const sizeMultiplier = Math.random() * 0.8 + 0.5;
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;
  drop.style.pointerEvents = "none";

  // Position the drop randomly across the game width
  // Subtract 60 pixels to keep drops fully inside the container
  const xPosition = getDropStartX(size);
  drop.style.left = xPosition + "px";
  const startTop = 46;
  drop.style.top = `${startTop}px`;
  // Use frame-based movement for the Y-axis so drops cannot disappear early
  // due to CSS animation timing/stacking edge cases.
  drop.style.animation = "none";

  const windEnabled = difficultySettings.windPxPerFrame > 0;
  let horizontalVelocity =
    (Math.random() < 0.5 ? -1 : 1) *
    difficultySettings.windPxPerFrame *
    (0.6 + Math.random() * 0.8);

  // Add the new drop to the game screen
  gameContainer.appendChild(drop);

  let dropResolved = false;
  let collisionFrameId;
  const fakeDropSpawnTime = performance.now();
  const fallDurationMs = difficultySettings.fallDurationSeconds * 1000;
  const dropHeight = drop.getBoundingClientRect().height || size;
  // Keep fall speed proportional to the game area for consistent pacing
  // across different screen sizes. The multiplier is tuned to preserve
  // the current gameplay feel.
  const travelDistance = gameContainer.clientHeight * 1.8 + dropHeight;
  const finalTop = startTop + travelDistance;
  let elapsedFallMs = 0;
  let lastFrameTime = performance.now();

  function flipFakeDrop() {
    if (
      dropResolved ||
      !drop.isConnected ||
      !drop.classList.contains("fake-drop") ||
      drop.classList.contains("flipped")
    ) {
      return;
    }

    drop.classList.remove("clean-water-drop");
    drop.classList.add("dirty-water-drop-brown", "flipped");
  }

  function resolveDrop(caughtByBucket = false, hitGrass = false) {
    if (dropResolved) return;

    dropResolved = true;
    cancelAnimationFrame(collisionFrameId);

    if (caughtByBucket) {
      playRandomSplashSound();
      WaterDropColorTracker(drop);
      currentScore += getDropScore(drop);
      updateScoreDisplay();
      if (drop.classList.contains("clean-water-drop")) {
        waterCollected = Math.min(waterCollected + SCORE_PER_CLEAN_DROP, MAX_WATER_SCORE);
      } else {
        waterCollected = Math.max(waterCollected + SCORE_PER_DIRTY_DROP, 0);
      }
      updateWaterBar();
      drop.style.animationPlayState = "paused";
      setTimeout(() => {
        drop.remove();
      }, 80);
      return;
    }

    if (hitGrass) {
      playRandomSplashSound();
      drop.style.animationPlayState = "paused";
      drop.classList.add("splash");
      setTimeout(() => drop.remove(), 300);
      return;
    }

    drop.remove();
  }

  function checkBucketCollision() {
    if (dropResolved || !drop.isConnected) return;

    const now = performance.now();
    const deltaMs = now - lastFrameTime;
    lastFrameTime = now;

    if (gamePaused) {
      collisionFrameId = requestAnimationFrame(checkBucketCollision);
      return;
    }

    elapsedFallMs += deltaMs;
    const fallProgress = Math.min(elapsedFallMs / fallDurationMs, 1);
    const currentTop = startTop + (finalTop - startTop) * fallProgress;
    drop.style.top = `${currentTop}px`;

    if (windEnabled) {
      const maxLeft = gameContainer.clientWidth - drop.offsetWidth;
      const currentLeft = parseFloat(drop.style.left) || 0;
      const nextLeft = currentLeft + horizontalVelocity;

      if (nextLeft <= 0 || nextLeft >= maxLeft) {
        horizontalVelocity *= -1;
      }

      if (Math.random() < 0.02) {
        horizontalVelocity += (Math.random() - 0.5) * 0.2;
      }

      const maxWindSpeed = difficultySettings.windPxPerFrame * 2;
      horizontalVelocity = Math.max(-maxWindSpeed, Math.min(horizontalVelocity, maxWindSpeed));

      drop.style.left = `${Math.max(0, Math.min(nextLeft, maxLeft))}px`;
    }

    const dropRect = drop.getBoundingClientRect();
    const bucketRect = bucket.getBoundingClientRect();
    const grassRect = grass.getBoundingClientRect();

    if (fakeDrop && !drop.classList.contains("flipped")) {
      const fakeDropAgeMs = performance.now() - fakeDropSpawnTime;
      const distanceToBucketPx = bucketRect.top - dropRect.bottom;
      const shouldWarn =
        fakeDropAgeMs >= FAKE_DROP_FLIP_DELAY_MS - FAKE_DROP_WARNING_MS ||
        distanceToBucketPx <= FAKE_DROP_WARNING_DISTANCE_PX;
      const shouldFlip =
        fakeDropAgeMs >= FAKE_DROP_FLIP_DELAY_MS ||
        distanceToBucketPx <= FAKE_DROP_FLIP_DISTANCE_PX;

      if (shouldWarn) {
        drop.classList.add("warning");
      }

      if (shouldFlip) {
        flipFakeDrop();
      }
    }

    if (intersects(dropRect, bucketRect)) {
      resolveDrop(true);
      return;
    }

    if (intersects(dropRect, grassRect)) {
      resolveDrop(false, true);
      return;
    }

    if (fallProgress >= 1) {
      resolveDrop(false, true);
      return;
    }

    collisionFrameId = requestAnimationFrame(checkBucketCollision);
  }

  collisionFrameId = requestAnimationFrame(checkBucketCollision);
}

function updateScoreBar(currentScore, maxScore) {
    const percentage = Math.max(0, (currentScore / maxScore) * 100);
    document.getElementById("score-bar").style.height = percentage + "%";
}

function updateWaterBar() {
    const pct = (waterCollected / MAX_WATER_SCORE) * 100;
    waterBarFill.style.height = pct + "%";
}

