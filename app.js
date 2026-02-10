// ===== EMAILJS SETUP & TRACKING =====
// Initialize EmailJS
(console.log('app.js loaded — version 2'));
(function() {
    // Wait for EmailJS to be loaded
    if (typeof emailjs !== 'undefined') {
        emailjs.init("fB8c5PYwG05CXbh-0");
        console.log('EmailJS initialized');
    } else {
        console.error('EmailJS not loaded');
    }
})();

async function safePlay() {
    try {
        await musicPlayer.play();
        playPauseBtn.textContent = '⏸️';
    } catch (e) {
        console.log("Play blocked:", e);
    }
}

// User selections tracker
const userSelections = {
    timestamp: new Date().toLocaleString(),
    answeredYes: false,
    flavorChoice: null,
    restaurantChoice: null,
    gameHighScore: 0,
    gameAttempts: 0,
    envelopeOpened: false,
    playPauseClicks: 0,
    nextButtonClicks: 0,
    prevButtonClicks: 0,
    musicMuted: false,
    songsSwitched: [],
    currentSongWhenSubmitted: null,
    timeSpentOnPage: 0,
    userEmail: 'Kavita'
};

// Function to send email with full tracking data
function sendSelectionEmail() {
    console.log('Sending email with tracking data...');
    
    // Get current song when submitted
    userSelections.currentSongWhenSubmitted = playlist[currentSongIndex].title;
    
    // Calculate time spent on page in seconds
    userSelections.timeSpentOnPage = Math.floor((Date.now() - pageLoadTime) / 1000);
    
    const templateParams = {
        to_email: 'dsingu2005@gmail.com',
        user_name: 'Kavita',
        email: 'dsingu2005@gmail.com',
        timestamp: userSelections.timestamp,
        answered_yes: userSelections.answeredYes ? 'Yes ✅' : 'No ❌',
        flavor_choice: userSelections.flavorChoice || 'Not selected',
        restaurant_choice: userSelections.restaurantChoice || 'Not selected',
        game_high_score: userSelections.gameHighScore,
        game_attempts: userSelections.gameAttempts,
        envelope_opened: userSelections.envelopeOpened ? 'Yes' : 'No',
        play_pause_clicks: userSelections.playPauseClicks,
        next_button_clicks: userSelections.nextButtonClicks,
        prev_button_clicks: userSelections.prevButtonClicks,
        music_muted: userSelections.musicMuted ? 'Yes' : 'No',
        songs_switched: userSelections.songsSwitched.join(', ') || 'None',
        current_song_at_submission: userSelections.currentSongWhenSubmitted,
        time_spent_seconds: userSelections.timeSpentOnPage,
        full_data: JSON.stringify(userSelections, null, 2)
    };
    
    console.log('Sending params:', templateParams);

    if (typeof emailjs === 'undefined') {
        console.error('EmailJS is not loaded!');
        return;
    }
    
    emailjs.send('service_5qgpr7g', 'template_oamcasi', templateParams)
        .then(function(response) {
            console.log('✅ Email sent successfully!', response.status, response.text);
        })
        .catch(function(error) {
            console.error('❌ Email failed to send:', error);
            alert('❌ Email failed: ' + JSON.stringify(error));
        });
}

// Track page load time
const pageLoadTime = Date.now();

// ===== MUSIC PLAYER =====
const musicPlayer = document.getElementById('musicPlayer');
const muteToggle = document.getElementById('muteToggle');
const soundPrompt = document.getElementById('soundPrompt');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const songTitle = document.getElementById('songTitle');
const songArtist = document.getElementById('songArtist');

// Verify elements exist
console.log('Music Player Elements:');
console.log('musicPlayer:', musicPlayer ? '✓' : '✗ MISSING');
console.log('playPauseBtn:', playPauseBtn ? '✓' : '✗ MISSING');
console.log('prevBtn:', prevBtn ? '✓' : '✗ MISSING');
console.log('nextBtn:', nextBtn ? '✓' : '✗ MISSING');
console.log('songTitle:', songTitle ? '✓' : '✗ MISSING');
console.log('songArtist:', songArtist ? '✓' : '✗ MISSING');

let isMuted = false;
let hasInteracted = false;
let currentSongIndex = 0;
let isSeeking = false;

// prefer metadata preload so duration becomes available sooner
try { musicPlayer.preload = 'metadata'; } catch (e) {}
// disable progress bar until metadata is loaded
try { progressBar.disabled = true; } catch (e) {}

// Playlist will be discovered by fetching the server directory listing at /music/
let playlist = [];

async function loadPlaylistFromJson() {
  try {
    const resp = await fetch('./music/playlist.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error('Could not fetch music/playlist.json');
    playlist = await resp.json();

    if (playlist.length > 0) {
      currentSongIndex = 0;
      musicPlayer.src = playlist[0].src;
      songTitle.textContent = playlist[0].title;
      songArtist.textContent = playlist[0].artist;
    } else {
      console.warn('music/playlist.json loaded but empty');
    }
  } catch (err) {
    console.error('Failed to load music/playlist.json:', err);
  }
}

// Load playlist from music/playlist.json (works locally and on static hosts)
loadPlaylistFromJson();


// --- Diagnostics: check server range support for a tracked URL ---
async function checkRangeSupport(url) {
    try {
        console.log('Checking range support for', url);
        // Try a small ranged request
        const resp = await fetch(url, { method: 'GET', headers: { 'Range': 'bytes=0-1' } });
        console.log('Range request status for', url, resp.status, resp.statusText);
        const accept = resp.headers.get('Accept-Ranges');
        if (accept) console.log('Accept-Ranges:', accept);
        return { status: resp.status, acceptRanges: accept };
    } catch (err) {
        console.warn('Range check failed for', url, err);
        return { status: null, error: err };
    }
}

// Warm up a small range for the URL to encourage servers/browsers to expose seekable ranges
async function warmupRange(url, size = 200000) {
    try {
        console.log('Warming range for', url, 'size', size);
        const resp = await fetch(url, { method: 'GET', headers: { 'Range': `bytes=0-${size}` } });
        console.log('Warmup range status', resp.status);
        // read a small portion to ensure browser processes content
        const blob = await resp.blob();
        console.log('Warmup read bytes', blob.size);
        // after warming, give browser a moment to update buffered/seekable
        await new Promise(r => setTimeout(r, 250));
        return { ok: true, status: resp.status, bytes: blob.size };
    } catch (err) {
        console.warn('Warmup failed for', url, err);
        return { ok: false, error: err };
    }
}

// Simple on-screen toast for user guidance
function showToast(msg, duration = 4000) {
    let t = document.getElementById('appToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'appToast';
        Object.assign(t.style, {
            position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '120px',
            background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px 14px', borderRadius: '10px', zIndex: 9999,
            fontSize: '14px', maxWidth: '80%', textAlign: 'center'
        });
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => { t.style.opacity = '0'; }, duration);
}

// Log seekable/buffered info on key media events
musicPlayer.addEventListener('canplay', () => {
    console.log('canplay fired; readyState', musicPlayer.readyState);
    logBufferSeekable();
});
musicPlayer.addEventListener('canplaythrough', () => {
    console.log('canplaythrough fired; readyState', musicPlayer.readyState);
    logBufferSeekable();
});
musicPlayer.addEventListener('progress', () => {
    logBufferSeekable();
});

function logBufferSeekable() {
    try {
        const ranges = [];
        for (let i = 0; i < musicPlayer.buffered.length; i++) {
            ranges.push([musicPlayer.buffered.start(i), musicPlayer.buffered.end(i)]);
        }
        const seekables = [];
        for (let i = 0; i < musicPlayer.seekable.length; i++) {
            seekables.push([musicPlayer.seekable.start(i), musicPlayer.seekable.end(i)]);
        }
        console.log('Buffered ranges', ranges, 'Seekable ranges', seekables, 'duration', musicPlayer.duration);
    } catch (e) {
        console.warn('logBufferSeekable error', e);
    }
}

// Format time helper
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update song info based on current time
function updateCurrentSong() {
    if (isSeeking) return; // suppress auto-update while seeking

    // Ensure `currentSongIndex` reflects the currently loaded file
    const src = musicPlayer.currentSrc || musicPlayer.src || '';
    const found = playlist.findIndex(item => src.endsWith(item.src));
    if (found !== -1 && found !== currentSongIndex) {
        currentSongIndex = found;
        songTitle.textContent = playlist[found].title;
        songArtist.textContent = playlist[found].artist;
    }
}

// Robust seek helper: tries a few times until the player's currentTime is close to target
async function seekTo(target) {
    isSeeking = true;
    // helper to wait for an event once with timeout
    const waitFor = (el, ev, timeout = 2000) => new Promise((res) => {
        let done = false;
        const onEv = () => { if (!done) { done = true; el.removeEventListener(ev, onEv); res(true); } };
        el.addEventListener(ev, onEv);
        setTimeout(() => { if (!done) { done = true; el.removeEventListener(ev, onEv); res(false); } }, timeout);
    });

    // ensure metadata is available before seeking
    if (musicPlayer.readyState < 1 || !musicPlayer.duration || isNaN(musicPlayer.duration)) {
        console.log('seekTo: waiting for metadata before seeking');
        const ok = await waitFor(musicPlayer, 'loadedmetadata', 3000);
        if (!ok) console.warn('seekTo: loadedmetadata did not fire within timeout');
    }
    let attempts = 0;
    while (attempts < 4) {
        try {
            // If seekable ranges exist, clamp target to available ranges
            if (musicPlayer.seekable && musicPlayer.seekable.length > 0) {
                const start = musicPlayer.seekable.start(0);
                const end = musicPlayer.seekable.end(0);
                const clamped = Math.max(start, Math.min(end - 0.2, target));
                musicPlayer.currentTime = clamped;
            } else {
                // No seekable ranges yet; still attempt to set currentTime
                musicPlayer.currentTime = target;
            }
        } catch (e) {
            console.warn('Setting currentTime threw:', e);
        }

        // wait for seeked event or timeout
        await new Promise((res) => {
            let done = false;
            const onSeeked = () => {
                if (!done) {
                    done = true;
                    musicPlayer.removeEventListener('seeked', onSeeked);
                    res();
                }
            };
            musicPlayer.addEventListener('seeked', onSeeked);
            setTimeout(() => {
                if (!done) {
                    done = true;
                    musicPlayer.removeEventListener('seeked', onSeeked);
                    res();
                }
            }, 350);
        });

        const now = musicPlayer.currentTime;
        console.log('seek attempt', attempts + 1, 'now', now, 'target', target);
        if (Math.abs(now - target) <= 0.5) break;
        attempts++;
    }

    isSeeking = false;

    if (Math.abs(musicPlayer.currentTime - target) > 1) {
        console.warn('Seek may not have reached target:', musicPlayer.currentTime, 'expected', target);
        // Common causes: server does not support Range requests (Accept-Ranges / partial content),
        // metadata not loaded, or the resource failed to load. Check network response headers and
        // ensure files are served over HTTP with byte-range support (status 206 for Range).
    }

    // fallback: attempt a larger warmup and retry once if seek failed
    if (Math.abs(musicPlayer.currentTime - target) > 1) {
        showToast('Seeking failed — attempting fallback to enable seeking...', 3000);
        console.log('Attempting warmup fallback for seek');
        const warm = await warmupRange(musicPlayer.currentSrc || musicPlayer.src, 2000000);
        console.log('Warmup fallback result', warm);
        // try setting currentTime again
        try {
            musicPlayer.currentTime = target;
        } catch (e) { console.warn('Setting currentTime (fallback) threw:', e); }
        // wait briefly for seeked
        await new Promise(r => setTimeout(r, 400));
        console.log('Post-fallback currentTime', musicPlayer.currentTime, 'target', target);
        if (Math.abs(musicPlayer.currentTime - target) > 1) {
            console.warn('Fallback seek still did not reach target');
            showToast('Seeking not available for this file on your server/browser.', 4000);
        }
    }

    // After seeking, simply try to play the current file at the target time
    await safePlay();
}

// Update progress bar
function updateProgress() {
    // Update progress for the current file
    if (musicPlayer.duration) {
        const elapsed = Math.max(0, musicPlayer.currentTime);
        const duration = musicPlayer.duration;
        const progress = (elapsed / duration) * 100;
        progressBar.value = progress;
        progressBar.style.background = `linear-gradient(to right, var(--primary-color) ${progress}%, #ddd ${progress}%)`;
        currentTimeEl.textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
    } else {
        // unknown duration
        progressBar.value = 0;
        currentTimeEl.textContent = `0:00 / 0:00`;
    }
}

// Seek functionality - seek within current song (support multiple interaction events)
function onProgressSeek(e) {
    console.log('progress interaction', e.type);
    if (isSeeking) return;
    const pct = Number(progressBar.value) / 100;
    const target = pct * (musicPlayer.duration || 0);
    if (!musicPlayer.duration || isNaN(musicPlayer.duration)) {
        // metadata not ready yet — store desired target and wait for loadedmetadata
        musicPlayer._pendingSeek = target;
        console.log('Metadata not ready, saved pending seek', musicPlayer._pendingSeek);
        return;
    }
    userSelections.manualSeeks = (userSelections.manualSeeks || 0) + 1;
    seekTo(Math.max(0, Math.min(musicPlayer.duration, target))).catch(console.error);
}

progressBar.addEventListener('input', onProgressSeek);
progressBar.addEventListener('change', onProgressSeek);
progressBar.addEventListener('pointerdown', onProgressSeek);
progressBar.addEventListener('click', onProgressSeek);

// Direct click/pointer handler that computes percentage from click position (more reliable)
async function onProgressBarPointerEvent(e) {
    // ignore if overlaying prompt is open
    if (document.getElementById('soundPrompt') && !document.getElementById('soundPrompt').classList.contains('hidden')) return;
    const rect = progressBar.getBoundingClientRect();
    let clientX = 0;
    if (e.type.startsWith('touch')) {
        clientX = e.touches && e.touches[0] ? e.touches[0].clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
    } else {
        clientX = e.clientX;
    }
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = x / rect.width;
    if (isSeeking) return;
    const target = pct * (musicPlayer.duration || 0);
    if (isSeeking) return;
    // if metadata/seekable exists but target lies outside seekable ranges, try a small ranged fetch to warm server
    const hasSeekable = (musicPlayer.seekable && musicPlayer.seekable.length > 0);
    if (!musicPlayer.duration || isNaN(musicPlayer.duration)) {
        musicPlayer._pendingSeek = target;
        console.log('Pointer event but metadata missing; pending seek saved', musicPlayer._pendingSeek);
        // update UI so user sees feedback
        progressBar.value = pct * 100;
        progressBar.style.background = `linear-gradient(to right, var(--primary-color) ${pct * 100}%, #ddd ${pct * 100}%)`;
        return;
    }
    // if seekable present, check if target is within the first seekable range
    if (hasSeekable) {
        try {
            const end = musicPlayer.seekable.end(0);
            if (target > end - 0.5) {
                console.log('Target outside current seekable end; warming range then retrying');
                await warmupRange(musicPlayer.src);
            }
        } catch (e) { console.warn('seekable check failed', e); }
    } else {
        // no seekable info yet — try warming
        console.log('No seekable ranges yet; warming range');
        await warmupRange(musicPlayer.src);
    }
    console.log('progress pointer event', e.type, 'clientX', clientX, 'rect', rect, 'pct', pct, 'target', target);
    // update UI immediately
    progressBar.value = pct * 100;
    progressBar.style.background = `linear-gradient(to right, var(--primary-color) ${pct * 100}%, #ddd ${pct * 100}%)`;
    userSelections.manualSeeks = (userSelections.manualSeeks || 0) + 1;
    // call seek
    seekTo(Math.max(0, Math.min(musicPlayer.duration, target))).catch(console.error);
}

progressBar.addEventListener('pointerdown', onProgressBarPointerEvent, { passive: true });
progressBar.addEventListener('click', onProgressBarPointerEvent);
progressBar.addEventListener('touchstart', onProgressBarPointerEvent, { passive: true });

// Play/Pause
playPauseBtn.addEventListener('click', async () => {
    userSelections.playPauseClicks++;

    if (musicPlayer.paused) {
        await safePlay();
    } else {
        musicPlayer.pause();
        playPauseBtn.textContent = '▶️';
    }
});


// Previous song
// Previous song
prevBtn.addEventListener('click', async () => {
    console.log('Previous button clicked. Current index:', currentSongIndex);
    userSelections.prevButtonClicks++;

    let newIndex = currentSongIndex > 0 ? currentSongIndex - 1 : playlist.length - 1;
    currentSongIndex = newIndex;
    const track = playlist[currentSongIndex];
    songTitle.textContent = track.title;
    songArtist.textContent = track.artist;
    userSelections.songsSwitched.push(track.title);

    musicPlayer.src = track.src;
    musicPlayer.load();
    checkRangeSupport(musicPlayer.src).then(r => console.log('Range check for prev track', r));
    await safePlay();

    console.log('Prev: Now playing', track.title);
});

// Next song
// Next song
nextBtn.addEventListener('click', async () => {
    console.log('Next button clicked. Current index:', currentSongIndex);
    userSelections.nextButtonClicks++;

    let newIndex = currentSongIndex < playlist.length - 1 ? currentSongIndex + 1 : 0;
    currentSongIndex = newIndex;
    const track = playlist[currentSongIndex];
    songTitle.textContent = track.title;
    songArtist.textContent = track.artist;
    userSelections.songsSwitched.push(track.title);

    musicPlayer.src = track.src;
    musicPlayer.load();
    checkRangeSupport(musicPlayer.src).then(r => console.log('Range check for next track', r));
    await safePlay();

    console.log('Next: Now playing', track.title);
});

// Single timeupdate listener: update progress and handle auto-advance
musicPlayer.addEventListener('timeupdate', () => {
    if (isSeeking) return;
    updateProgress();

    if (musicPlayer.duration && musicPlayer.currentTime >= musicPlayer.duration - 0.5) {
        // advance to next file
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        const track = playlist[currentSongIndex];
        songTitle.textContent = track.title;
        songArtist.textContent = track.artist;
        musicPlayer.src = track.src;
        musicPlayer.load();
        if (!musicPlayer.paused) safePlay();
    }
});

// Add event listener for when audio metadata loads
musicPlayer.addEventListener('loadedmetadata', () => {
    console.log('Audio loaded, src:', musicPlayer.currentSrc || musicPlayer.src, 'duration:', musicPlayer.duration, 'readyState:', musicPlayer.readyState, 'networkState:', musicPlayer.networkState);
    // enable progress bar once metadata is available
    try { progressBar.disabled = false; } catch (e) {}
    // if there was a pending seek request before metadata loaded, perform it now
    if (typeof musicPlayer._pendingSeek === 'number') {
        const t = musicPlayer._pendingSeek;
        delete musicPlayer._pendingSeek;
        console.log('Performing pending seek to', t);
        seekTo(t).catch(console.error);
    }
});

musicPlayer.addEventListener('error', (e) => {
    console.error('Audio error:', e);
});

// // Auto-advance to next song (single listener)
// musicPlayer.addEventListener('timeupdate', () => {
//     updateProgress();

//     const song = playlist[currentSongIndex];

//     if (musicPlayer.currentTime >= song.end - 0.2) {
//         currentSongIndex = (currentSongIndex + 1) % playlist.length;

//         const nextSong = playlist[currentSongIndex];

//         musicPlayer.currentTime = nextSong.start;

//         songTitle.textContent = nextSong.title;
//         songArtist.textContent = nextSong.artist;

//         if (!musicPlayer.paused) safePlay();
//     }
// });

// Show sound prompt on load
window.addEventListener('load', () => {
    soundPrompt.classList.remove('hidden');
});

// Sound prompt interaction
soundPrompt.addEventListener('click', () => {
    soundPrompt.classList.add('hidden');
    hasInteracted = true;

    // start from beginning of current file
    try {
        musicPlayer.currentTime = 0;
    } catch (e) {
        console.warn('Could not set currentTime on soundPrompt:', e);
    }
    safePlay();
});


// Mute toggle
muteToggle.addEventListener('click', () => {
    isMuted = !isMuted;
    musicPlayer.muted = isMuted;
    userSelections.musicMuted = isMuted;
    muteToggle.querySelector('.mute-icon').textContent = isMuted ? '🔇' : '🔊';
});

// ===== SCROLL REVEAL ANIMATIONS =====
const reveals = document.querySelectorAll('.reveal');

function checkScroll() {
    reveals.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        
        if (elementTop < windowHeight - 100) {
            element.classList.add('active');
        }
    });
}

window.addEventListener('scroll', checkScroll);
checkScroll();

// ===== PLAYLIST POPUP =====
let playlistPopupShown = false;

function showPlaylistPopup() {
    if (playlistPopupShown) return;
    
    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    
    // Show popup when user is 25-30% down the page
    if (scrollPercent >= 25 && scrollPercent <= 30) {
        playlistPopupShown = true;
        
        const popup = document.createElement('div');
        popup.className = 'playlist-popup';
        popup.innerHTML = `
            <div class="playlist-popup-content">
                <button class="playlist-popup-close">&times;</button>
                <p>💕 This playlist was curated with all songs that remind me of you, Kavita 💕</p>
            </div>
        `;
        document.body.appendChild(popup);
        
        setTimeout(() => popup.classList.add('show'), 100);
        
        const closeBtn = popup.querySelector('.playlist-popup-close');
        closeBtn.addEventListener('click', () => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 300);
        });
        
        // Auto-close after 6 seconds
        setTimeout(() => {
            if (popup.parentElement) {
                popup.classList.remove('show');
                setTimeout(() => popup.remove(), 300);
            }
        }, 6000);
    }
}

window.addEventListener('scroll', showPlaylistPopup);

// ===== LETTER ENVELOPE =====
const letterSection = document.getElementById('letter');
let letterOpened = false;

// Create envelope overlay
const envelopeOverlay = document.createElement('div');
envelopeOverlay.className = 'envelope-overlay';
envelopeOverlay.innerHTML = `
    <div class="envelope">
        <div class="envelope-flap"></div>
        <div class="envelope-body">
            <div class="envelope-heart">💌</div>
            <p class="envelope-text">Click to open</p>
        </div>
    </div>
`;
letterSection.appendChild(envelopeOverlay);

envelopeOverlay.addEventListener('click', () => {
    if (!letterOpened) {
        letterOpened = true;
        userSelections.envelopeOpened = true;
        envelopeOverlay.classList.add('opening');
        
        setTimeout(() => {
            envelopeOverlay.style.display = 'none';
        }, 1000);
    }
});

// ===== PROPOSAL INTERACTION =====
const yesBtn = document.getElementById('yesBtn');
const noBtn = document.getElementById('noBtn');
const proposalSection = document.getElementById('proposal');
const restaurantsSection = document.getElementById('restaurants');

yesBtn.addEventListener('click', () => {
    // Track selection
    userSelections.answeredYes = true;
    
    // Hide proposal section
    proposalSection.classList.add('hidden');
    
    // Show restaurants section
    restaurantsSection.classList.remove('hidden');
    
    // Scroll to restaurants section
    restaurantsSection.scrollIntoView({ behavior: 'smooth' });
});

// Make "No" button run away
function moveNoButtonNearYes() {
    const yesRect = yesBtn.getBoundingClientRect();
    const yesCenterX = yesRect.left + yesRect.width / 2;
    const yesCenterY = yesRect.top + yesRect.height / 2;

    const radius = Math.min(120, Math.max(60, Math.min(window.innerWidth, window.innerHeight) * 0.12));
    const angle = Math.random() * Math.PI * 2; // random angle
    let newX = yesCenterX + Math.cos(angle) * (40 + Math.random() * (radius - 40));
    let newY = yesCenterY + Math.sin(angle) * (20 + Math.random() * (radius - 20));

    const pad = 12;
    newX = Math.max(pad, Math.min(window.innerWidth - noBtn.offsetWidth - pad, newX - noBtn.offsetWidth / 2));
    newY = Math.max(pad, Math.min(window.innerHeight - noBtn.offsetHeight - pad, newY - noBtn.offsetHeight / 2));

    noBtn.style.position = 'fixed';
    noBtn.style.left = newX + 'px';
    noBtn.style.top = newY + 'px';
    noBtn.style.transition = 'all 0.18s ease';
}

noBtn.addEventListener('mouseenter', moveNoButtonNearYes);
noBtn.addEventListener('click', moveNoButtonNearYes);
noBtn.addEventListener('touchstart', (e) => { e.preventDefault(); moveNoButtonNearYes(); });

// ===== RESTAURANTS SELECTION =====
const flavorChoice = document.getElementById('flavorChoice');
const restaurantChoice = document.getElementById('restaurantChoice');
const comfortOptions = document.getElementById('comfortOptions');
const newOptions = document.getElementById('newOptions');
const restaurantConfirmation = document.getElementById('restaurantConfirmation');
const sadGif = document.getElementById('sadGif');
const playGameBtn = document.getElementById('playGameBtn');

let selectedFlavor = null;
let selectedRestaurant = null;

// Flavor choice buttons
document.querySelectorAll('[data-flavor]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedFlavor = e.target.dataset.flavor;
        
        // Track selection
        userSelections.flavorChoice = selectedFlavor === 'comfort' ? 'Comfort Spots' : 'Something New';
        
        // Hide flavor choice
        flavorChoice.style.display = 'none';
        
        // Show restaurant options
        restaurantChoice.classList.remove('hidden');
        
        if (selectedFlavor === 'comfort') {
            comfortOptions.classList.remove('hidden');
            newOptions.classList.add('hidden');
        } else {
            newOptions.classList.remove('hidden');
            comfortOptions.classList.add('hidden');
        }
    });
});

// Restaurant selection buttons
document.querySelectorAll('[data-restaurant]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const restaurant = e.currentTarget.dataset.restaurant;
        
        if (restaurant === 'none') {
            // Track selection
            userSelections.restaurantChoice = 'None selected';
            
            // Hide restaurant options
            restaurantChoice.style.display = 'none';
            
            // Show sad GIF
            sadGif.classList.remove('hidden');
            return;
        }
        
        selectedRestaurant = restaurant;
        
        // Hide restaurant options
        restaurantChoice.style.display = 'none';
        
        // Get restaurant name
        const restaurantNames = {
            'taj': 'Taj Stamford',
            'xan-niang': 'Xan Niang Dumpling Spot 🥟',
            'barcelona': 'Barcelona Wine Bar 🍷',
            'mecha': 'Mecha Noodle Bar 🍜',
            'cka-ka-qellu': 'Çka Ka Qëllu 🍴'
        };
        
        const restaurantName = restaurantNames[restaurant] || restaurant;
        
        // Track selection
        userSelections.restaurantChoice = restaurantName;
        
        // Send email with all tracking data
        sendSelectionEmail();
        
        // Show confirmation
        restaurantConfirmation.classList.remove('hidden');
        restaurantConfirmation.querySelector('.confirmation-text').textContent = 
            `Perfect! Let's go to ${restaurantName} for our Valentine's date! 💕`;
    });
});

// Play game button
playGameBtn.addEventListener('click', () => {
    const gameSection = document.getElementById('game');
    gameSection.classList.remove('hidden');
    gameSection.scrollIntoView({ behavior: 'smooth' });
});

// ===== CLASSIC FLAPPY BIRD GAME =====
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const startGameBtn = document.getElementById('startGameBtn');
const gameStartScreen = document.getElementById('gameStartScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const restartGameBtn = document.getElementById('restartGameBtn');
const currentScoreEl = document.getElementById('currentScore');
const highScoreEl = document.getElementById('highScore');
const finalScoreEl = document.getElementById('finalScore');

// Set canvas size
gameCanvas.width = 400;
gameCanvas.height = 600;

let gameRunning = false;
let score = 0;
let highScore = localStorage.getItem('flappyBirdHighScore') || 0;
highScoreEl.textContent = highScore;

// Game objects
let bird = {
    x: 100,
    y: 300,
    width: 34,
    height: 24,
    velocity: 0,
    gravity: 0.35,
    jumpStrength: -7,
    maxVelocity: 8
};

let pipes = [];
const PIPE_WIDTH = 60;
const PIPE_GAP = 180; // Larger gap for easier gameplay
const PIPE_SPEED = 2; // Slower speed for easier gameplay
const PIPE_SPACING = 250; // Minimum spacing between pipes

function resetBird() {
    bird.y = 300;
    bird.velocity = 0;
}

function createPipe() {
    const minHeight = 80;
    const maxHeight = gameCanvas.height - PIPE_GAP - minHeight;
    const topHeight = minHeight + Math.random() * (maxHeight - minHeight);
    
    pipes.push({
        x: gameCanvas.width,
        topHeight: topHeight,
        bottomY: topHeight + PIPE_GAP,
        passed: false
    });
}

function canCreatePipe() {
    if (pipes.length === 0) return true;
    const lastPipe = pipes[pipes.length - 1];
    return lastPipe.x < gameCanvas.width - PIPE_SPACING;
}

function startGame() {
    gameRunning = true;
    score = 0;
    pipes = [];
    resetBird();
    
    // Track game attempt
    userSelections.gameAttempts++;
    
    gameStartScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    currentScoreEl.textContent = score;
    
    // Create first pipe
    createPipe();
    
    gameLoop();
}

function gameLoop() {
    if (!gameRunning) return;
    
    // Clear canvas with sky blue background
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Update bird with smoother physics
    bird.velocity += bird.gravity;
    // Cap velocity for smoother movement
    bird.velocity = Math.max(-bird.maxVelocity, Math.min(bird.maxVelocity, bird.velocity));
    bird.y += bird.velocity;
    
    // Draw bird (simple heart emoji)
    ctx.font = '34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💕', bird.x, bird.y);
    
    // Update and draw pipes - only create when there's enough space
    if (canCreatePipe()) {
        createPipe();
    }
    
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        
        // Move pipe
        pipe.x -= PIPE_SPEED;
        
        // Draw top pipe
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        
        // Draw bottom pipe
        ctx.fillRect(pipe.x, pipe.bottomY, PIPE_WIDTH, gameCanvas.height - pipe.bottomY);
        
        // Add pipe caps for classic look
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, PIPE_WIDTH + 10, 20);
        ctx.fillRect(pipe.x - 5, pipe.bottomY, PIPE_WIDTH + 10, 20);
        
        // Check if bird passed pipe
        if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
            pipe.passed = true;
            score++;
            currentScoreEl.textContent = score;
        }
        
        // Check collision
        if (
            bird.x + 17 > pipe.x &&
            bird.x - 17 < pipe.x + PIPE_WIDTH &&
            (bird.y - 12 < pipe.topHeight || bird.y + 12 > pipe.bottomY)
        ) {
            endGame();
            return;
        }
        
        // Remove off-screen pipes
        if (pipe.x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
        }
    }
    
    // Check if bird hit ground or ceiling
    if (bird.y + 12 > gameCanvas.height || bird.y - 12 < 0) {
        endGame();
        return;
    }
    
    requestAnimationFrame(gameLoop);
}

function endGame() {
    gameRunning = false;
    
    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyBirdHighScore', highScore);
        highScoreEl.textContent = highScore;
        
        // Track high score
        userSelections.gameHighScore = highScore;
    }
    
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

// Jump on click/tap
gameCanvas.addEventListener('click', () => {
    if (gameRunning) {
        bird.velocity = bird.jumpStrength;
    }
});

// Jump on spacebar
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameRunning) {
        e.preventDefault();
        bird.velocity = bird.jumpStrength;
    }
});

startGameBtn.addEventListener('click', startGame);
restartGameBtn.addEventListener('click', startGame);
