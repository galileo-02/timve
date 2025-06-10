// Register Service Worker for PWA capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Ensure the DOM is fully loaded before running any script
document.addEventListener("DOMContentLoaded", () => {
  // ... rest of your script.js content
});
// Ensure the DOM is fully loaded before running any script
document.addEventListener("DOMContentLoaded", () => {
  // --- 1. Element References ---
  // Centralized collection of all DOM elements used in the script.
  // This makes it easy to see what elements are being manipulated.

  // Top Bar Elements
  const searchInput = document.getElementById("searchInput");
  const userProfilePic = document.getElementById("userProfilePic");

  // Left Sidebar Navigation Elements
  const navHome = document.querySelector(
    ".sidebar-nav-main .nav-item-main[data-section='homeSection']"
  );
  const navSearch = document.querySelector(
    ".sidebar-nav-main .nav-item-main[data-section='exploreSection']"
  );
  const navLibrary = document.querySelector(
    ".sidebar-nav-main .nav-item-main[data-section='yourLibrarySection']"
  );
  const navPlayQueue = document.querySelector(
    ".sidebar-nav-main .nav-item-main[data-section='playQueueSection']"
  );
  const navSettings = document.querySelector(
    ".sidebar-nav-main .nav-item-main[data-section='settingsSection']"
  );
  const navItemsMain = document.querySelectorAll(
    ".sidebar-nav-main .nav-item-main"
  ); // All main nav items

  // NEW: Sidebar Toggle Elements
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  const sidebarLeft = document.querySelector(".sidebar-left"); // Reference to the sidebar
  // END NEW

  // Main Content Section Elements
  const contentSections = document.querySelectorAll(
    ".main-content-area .content-section"
  );
  const rightPanelHome = document.querySelector(".right-panel-home"); // Right panel on home section
  const contentTabs = document.querySelectorAll(".content-tab"); // Tabs like 'All Music', 'Podcasts'

  // Audio Player Control Elements
  const audioPlayer = document.getElementById("audioPlayer");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const favoriteBtn = document.getElementById("favoriteBtn");
  const progressBar = document.getElementById("progressBar");
  const progressContainer = document.getElementById("progressContainer");
  const currentTimeSpan = document.getElementById("currentTime");
  const durationTimeSpan = document.getElementById("durationTime");
  const volumeSlider = document.getElementById("volumeSlider");
  const currentVolumeIcon = document.getElementById("currentVolumeIcon");
  const currentSongTitle = document.getElementById("currentSongTitle");
  const albumArtDisplay = document.getElementById("albumArtDisplay");

  // Bottom Player Right Controls Elements
  const lyricsToggleBtn = document.getElementById("lyricsToggleBtn");
  const shareToggleBtn = document.getElementById("shareToggleBtn");
  const visualizerToggleBtn = document.getElementById("visualizerToggleBtn");
  const visualizerCanvas = document.getElementById("visualizerCanvas");
  const visualizerPlaceholder = document.getElementById(
    "visualizerPlaceholder"
  );

  // Play Queue Specific Elements
  const fileInput = document.getElementById("fileInput"); // The actual hidden file input
  const customUploadBtn = document.querySelector(".custom-file-upload"); // The styled label for file input

  const playQueueList = document.getElementById("playQueueList");

  // Liked Songs Specific Elements
  const likedSongsList = document.getElementById("likedSongsList");

  // Settings Specific Elements (for Player Settings & EQ)
  const playbackSpeedSelect = document.getElementById("playbackSpeed");
  const sleepTimerInput = document.getElementById("sleepTimerInput");
  const setSleepTimerBtn = document.getElementById("setSleepTimerBtn");
  const eqSliders = document.querySelectorAll(".eq-slider");
  const eqResetBtn = document.getElementById("eqResetBtn");

  // --- 2. Global Player State Variables ---
  // These variables manage the current state of the music player.
  let playQueue = []; // Stores song objects (name, src, file)
  let currentSongIndex = -1; // Index of the song currently playing (-1 if none)
  let isShuffling = false; // True if shuffle mode is active
  let repeatMode = "none"; // 'none', 'one', 'all' for repeat functionality
  let sleepTimerTimeout; // Stores the ID of the setTimeout for the sleep timer

  // Liked songs are persisted using localStorage for offline access.
  let likedSongs = JSON.parse(localStorage.getItem("likedSongs")) || [];

  // AudioContext and related nodes for Visualizer and Equalizer
  let audioContext;
  let analyser;
  let dataArray;
  let sourceNode; // Connects audioPlayer to AudioContext graph
  let visualizerEnabled = false; // True if visualizer is active
  let animationFrameId; // Stores the requestAnimationFrame ID for visualizer loop
  let gainNodes = {}; // Maps frequency bands to their respective GainNode objects for EQ

  // --- 3. Utility Functions ---
  // Small, reusable functions that perform specific tasks.

  /**
   * Formats time in seconds into MM:SS format.
   * @param {number} seconds - The time in seconds.
   * @returns {string} Formatted time string.
   */
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  }

  /**
   * Displays a message to the user. Currently uses console.log,
   * but can be extended to show a custom modal or toast notification.
   * @param {string} message - The message content.
   */
  function displayMessage(message) {
    console.log("Timve Message:", message);
    // Future enhancement: Add a custom UI element for messages
  }

  // --- 4. Core Player Logic Functions ---
  // Functions directly related to music playback control.

  /**
   * Toggles the play/pause state of the audio player.
   * If no song is loaded, attempts to load and play the first in queue.
   */
  function togglePlayPause() {
    if (audioPlayer.paused) {
      if (audioPlayer.src) {
        // Only play if a song is loaded
        audioPlayer.play();
        playBtn.style.display = "none";
        pauseBtn.style.display = "inline-block";
        if (visualizerEnabled) startVisualizer();
      } else {
        if (playQueue.length > 0) {
          loadSong(0); // Load and play the first song if nothing is loaded
        } else {
          displayMessage(
            "No songs in queue to play. Please upload some music!"
          );
        }
      }
    } else {
      audioPlayer.pause();
      playBtn.style.display = "inline-block";
      pauseBtn.style.display = "none";
      stopVisualizer();
    }
  }

  /**
   * Loads a song into the audio player and starts playback.
   * Updates UI elements like song title and album art.
   * @param {number} index - The index of the song in the playQueue array.
   */
  function loadSong(index) {
    if (index >= 0 && index < playQueue.length) {
      currentSongIndex = index;
      const song = playQueue[currentSongIndex];
      audioPlayer.src = song.src;
      currentSongTitle.textContent = song.name;
      albumArtDisplay.src = song.albumArt || "./images/default-album-art.png"; // Use default if no specific art
      audioPlayer.load(); // Load the new audio source
      togglePlayPause(); // Start playing the new song

      updatePlayQueueUI(); // Highlight current song in queue
      updateFavoriteButton(); // Update favorite button state
      setupAudioContext(); // Re-setup audio context for new source
    } else if (playQueue.length === 0) {
      // Reset player if queue becomes empty
      currentSongIndex = -1;
      audioPlayer.pause();
      audioPlayer.src = "";
      currentSongTitle.textContent = "No song playing";
      albumArtDisplay.src = "./images/default-album-art.png";
      playBtn.style.display = "inline-block";
      pauseBtn.style.display = "none";
      stopVisualizer();
    }
  }

  /**
   * Determines and plays the next song based on shuffle and repeat settings.
   */
  function playNextSong() {
    if (playQueue.length === 0) return;

    let nextIndex = currentSongIndex;
    if (repeatMode === "one") {
      // Stay on the same song
    } else if (isShuffling) {
      // Pick a random song, ensuring it's not the same if there are other options
      do {
        nextIndex = Math.floor(Math.random() * playQueue.length);
      } while (nextIndex === currentSongIndex && playQueue.length > 1);
    } else {
      // Go to the next song, wrapping around to the beginning if at the end
      nextIndex = (currentSongIndex + 1) % playQueue.length;
    }

    // If repeat is off and we've looped back to the start (meaning end of list), pause
    if (
      repeatMode === "none" &&
      nextIndex === 0 &&
      currentSongIndex === playQueue.length - 1
    ) {
      audioPlayer.pause();
      playBtn.style.display = "inline-block";
      pauseBtn.style.display = "none";
      // Keep current song info displayed
      if (playQueue[currentSongIndex]) {
        currentSongTitle.textContent = playQueue[currentSongIndex].name;
      }
      stopVisualizer();
    } else {
      loadSong(nextIndex);
    }
  }

  /**
   * Plays the previous song or restarts the current song if already playing for a few seconds.
   */
  function playPreviousSong() {
    if (playQueue.length === 0) return;

    if (audioPlayer.currentTime > 3) {
      // If song is more than 3 seconds in, restart it
      audioPlayer.currentTime = 0;
    } else {
      let prevIndex = currentSongIndex;
      if (isShuffling) {
        // Pick a random song, ensuring it's not the same if there are other options
        do {
          prevIndex = Math.floor(Math.random() * playQueue.length);
        } while (prevIndex === currentSongIndex && playQueue.length > 1);
      } else {
        // Go to the previous song, wrapping around to the end if at the beginning
        prevIndex =
          (currentSongIndex - 1 + playQueue.length) % playQueue.length;
      }
      loadSong(prevIndex);
    }
  }

  // --- 5. Event Listener Setup ---
  // All event listeners are grouped here for clarity.

  /**
   * Sets up all necessary event listeners for player controls, navigation, and other features.
   */
  function setupEventListeners() {
    // Player Control Buttons
    playBtn.addEventListener("click", togglePlayPause);
    pauseBtn.addEventListener("click", togglePlayPause);
    prevBtn.addEventListener("click", playPreviousSong);
    nextBtn.addEventListener("click", playNextSong);

    shuffleBtn.addEventListener("click", () => {
      isShuffling = !isShuffling;
      shuffleBtn.classList.toggle("active", isShuffling);
      displayMessage(`Shuffle is now ${isShuffling ? "ON" : "OFF"}`);
    });

    repeatBtn.addEventListener("click", () => {
      if (repeatMode === "none") {
        repeatMode = "all";
        repeatBtn.className = "control-btn repeat-btn active"; // Style for 'repeat all'
        repeatBtn.innerHTML = '<i class="fas fa-redo-alt"></i>';
        repeatBtn.title = "Repeat All";
        displayMessage("Repeat All Songs");
      } else if (repeatMode === "all") {
        repeatMode = "one";
        repeatBtn.className = "control-btn repeat-btn active-one"; // Style for 'repeat one'
        repeatBtn.innerHTML =
          '<i class="fas fa-redo-alt"></i><span class="repeat-one-indicator">1</span>';
        repeatBtn.title = "Repeat One Song";
        displayMessage("Repeat One Song");
      } else {
        repeatMode = "none";
        repeatBtn.className = "control-btn repeat-btn"; // Back to default style
        repeatBtn.innerHTML = '<i class="fas fa-redo-alt"></i>';
        repeatBtn.title = "Toggle Repeat";
        displayMessage("Repeat Off");
      }
    });

    // Audio Player Events
    audioPlayer.addEventListener("timeupdate", updateProgressBar);
    audioPlayer.addEventListener("loadedmetadata", updateDurationTime);
    audioPlayer.addEventListener("ended", playNextSong); // Auto-play next on end

    // Progress Bar Interaction
    progressContainer.addEventListener("click", seekAudio);

    // Volume Control
    volumeSlider.addEventListener("input", handleVolumeChange);
    currentVolumeIcon.addEventListener("click", toggleMute);

    // Sidebar Navigation
    navItemsMain.forEach((item) => {
      item.addEventListener("click", () => {
        const targetSectionId = item.dataset.section;
        showMainContentSection(targetSectionId); // Use the helper function
      });
    });

    // NEW: Sidebar Toggle Event Listener
    sidebarToggleBtn.addEventListener("click", () => {
      sidebarLeft.classList.toggle("collapsed");
    });
    // END NEW

    // Content Tabs (e.g., All Music, Podcasts on Home section)
    contentTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        contentTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        // Future: Add logic here to filter/display content based on tab
      });
    });

    // File Input for Offline Upload
    fileInput.addEventListener("change", handleFileUpload);
    // Explicitly trigger file input click when custom upload button is clicked
    if (customUploadBtn) {
      // Ensure customUploadBtn exists before adding listener
      customUploadBtn.addEventListener("click", () => {
        fileInput.click(); // Programmatically click the hidden file input
      });
    }

    // Liked Songs Button
    favoriteBtn.addEventListener("click", toggleFavoriteSong);

    // Lyrics and Share Toggles
    lyricsToggleBtn.addEventListener("click", () =>
      showMainContentSection("lyricsSection")
    );
    shareToggleBtn.addEventListener("click", () =>
      showMainContentSection("shareSection")
    );

    // Settings Controls
    playbackSpeedSelect.addEventListener("change", handlePlaybackSpeedChange);
    setSleepTimerBtn.addEventListener("click", setSleepTimer);
    eqSliders.forEach((slider) => {
      slider.addEventListener("input", updateGainNodes);
    });
    eqResetBtn.addEventListener("click", resetEqualizer);

    // Visualizer Toggle
    visualizerToggleBtn.addEventListener("click", toggleVisualizerDisplay);

    // Window Resize for Visualizer
    window.addEventListener("resize", handleVisualizerResize);
  }

  // --- 6. Detailed Event Handlers ---
  // Functions that are called by event listeners.

  /**
   * Updates the progress bar and current time display during playback.
   */
  function updateProgressBar() {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.style.width = `${progress}%`;
    currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
  }

  /**
   * Updates the total duration time display when song metadata is loaded.
   */
  function updateDurationTime() {
    durationTimeSpan.textContent = formatTime(audioPlayer.duration);
  }

  /**
   * Seeks to a new position in the audio when the progress bar is clicked.
   * @param {MouseEvent} e - The click event.
   */
  function seekAudio(e) {
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    const duration = audioPlayer.duration;
    if (!isNaN(duration) && duration > 0) {
      audioPlayer.currentTime = (clickX / width) * duration;
    }
  }

  /**
   * Handles changes to the volume slider.
   * @param {Event} e - The input event from the slider.
   */
  function handleVolumeChange(e) {
    audioPlayer.volume = parseFloat(e.target.value);
    updateVolumeIcon();
  }

  /**
   * Toggles mute/unmute state and updates the volume icon.
   */
  function toggleMute() {
    if (audioPlayer.volume > 0) {
      audioPlayer.dataset.lastVolume = audioPlayer.volume; // Save current volume
      audioPlayer.volume = 0;
      volumeSlider.value = 0;
    } else {
      audioPlayer.volume = parseFloat(audioPlayer.dataset.lastVolume || 1); // Restore or default to 1
      volumeSlider.value = audioPlayer.volume;
    }
    updateVolumeIcon();
  }

  /**
   * Manages the visibility of main content sections and associated UI elements.
   * @param {string} sectionId - The ID of the section to activate.
   */
  function showMainContentSection(sectionId) {
    // Deactivate all sections first
    contentSections.forEach((section) => section.classList.remove("active"));
    navItemsMain.forEach((nav) => nav.classList.remove("active"));

    // Activate the target section and its corresponding nav item
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add("active");
    }
    const correspondingNavItem = document.querySelector(
      `.sidebar-nav-main .nav-item-main[data-section='${sectionId}']`
    );
    if (correspondingNavItem) {
      correspondingNavItem.classList.add("active");
    }

    // Handle visibility of the right panel on the home section
    if (rightPanelHome) {
      rightPanelHome.style.display =
        sectionId === "homeSection" ? "flex" : "none";
    }

    // Handle visibility of file upload elements for Play Queue
    if (sectionId === "playQueueSection") {
      if (fileInput) fileInput.style.display = "block";
      if (customUploadBtn) customUploadBtn.style.display = "inline-block";
    } else {
      if (fileInput) fileInput.style.display = "none";
      if (customUploadBtn) customUploadBtn.style.display = "none";
    }

    // Update liked songs list when navigating to its section
    if (sectionId === "likedSongsSection") {
      displayLikedSongs();
    }
  }

  /**
   * Handles the selection of files for upload to the play queue.
   * @param {Event} event - The change event from the file input.
   */
  function handleFileUpload(event) {
    const files = event.target.files;
    if (files.length > 0) {
      // Remove "No songs in queue" message if present
      const emptyMessage = playQueueList.querySelector(".empty-queue");
      if (emptyMessage) {
        emptyMessage.remove();
      }

      for (const file of files) {
        if (file.type.startsWith("audio/")) {
          const song = {
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension for display
            src: URL.createObjectURL(file), // Create a URL for the local file
            file: file, // Store the File object itself
          };
          playQueue.push(song);
        }
      }
      updatePlayQueueUI(); // Refresh the play queue display
      if (currentSongIndex === -1 && playQueue.length > 0) {
        loadSong(0); // Load and play the first song if nothing is currently playing
      }
      displayMessage(`Added ${files.length} song(s) to queue!`);
    }
  }

  /**
   * Toggles the current song's favorite status and updates localStorage.
   */
  function toggleFavoriteSong() {
    if (currentSongIndex === -1 || playQueue.length === 0) {
      displayMessage("No song playing to favorite.");
      return;
    }

    const currentSong = playQueue[currentSongIndex];
    const isLiked = likedSongs.some((song) => song.src === currentSong.src);

    if (isLiked) {
      likedSongs = likedSongs.filter((song) => song.src !== currentSong.src);
      favoriteBtn.classList.remove("active");
      displayMessage(`Unliked: "${currentSong.name}"`);
    } else {
      likedSongs.push(currentSong);
      favoriteBtn.classList.add("active");
      displayMessage(`Liked: "${currentSong.name}"`);
    }
    localStorage.setItem("likedSongs", JSON.stringify(likedSongs)); // Save to local storage
    displayLikedSongs(); // Update liked songs list if visible
  }

  /**
   * Handles changes to the playback speed.
   * @param {Event} e - The change event from the select element.
   */
  function handlePlaybackSpeedChange(e) {
    audioPlayer.playbackRate = parseFloat(e.target.value);
    displayMessage(`Playback speed set to ${e.target.value}x`);
  }

  /**
   * Sets a sleep timer to pause the audio player after a specified number of minutes.
   */
  function setSleepTimer() {
    clearTimeout(sleepTimerTimeout); // Clear any existing timer
    const minutes = parseInt(sleepTimerInput.value, 10);
    if (minutes > 0) {
      const milliseconds = minutes * 60 * 1000;
      sleepTimerTimeout = setTimeout(() => {
        audioPlayer.pause();
        playBtn.style.display = "inline-block";
        pauseBtn.style.display = "none";
        displayMessage(
          `Sleep timer ended! Timve has paused after ${minutes} minutes.`
        );
        stopVisualizer();
        setSleepTimerBtn.classList.remove("active");
      }, milliseconds);
      displayMessage(`Sleep timer set for ${minutes} minutes!`);
      setSleepTimerBtn.classList.add("active");
    } else {
      displayMessage(
        "Please enter a valid number of minutes for the sleep timer."
      );
      setSleepTimerBtn.classList.remove("active");
    }
  }

  /**
   * Resets all equalizer sliders to their default (0 gain) positions.
   */
  function resetEqualizer() {
    eqSliders.forEach((slider) => {
      slider.value = 0;
    });
    updateGainNodes(); // Apply the reset to the actual gain nodes
    displayMessage("Equalizer settings reset.");
  }

  /**
   * Handles window resize events, particularly for the visualizer canvas.
   */
  function handleVisualizerResize() {
    if (visualizerEnabled && visualizerCanvas.style.display !== "none") {
      visualizerCanvas.width = visualizerCanvas.offsetWidth;
      visualizerCanvas.height = visualizerCanvas.offsetHeight;
      // Redraw immediately after resize
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      startVisualizer();
    }
  }

  // --- 7. UI Update Functions ---
  // Functions responsible for updating the visual state of the application.

  /**
   * Updates the display of the play queue list in the UI.
   * Highlights the currently playing song.
   */
  function updatePlayQueueUI() {
    playQueueList.innerHTML = ""; // Clear current list
    if (playQueue.length === 0) {
      playQueueList.innerHTML =
        '<li class="empty-queue">No songs in queue. Add some music!</li>';
      return;
    }

    playQueue.forEach((song, index) => {
      const listItem = document.createElement("li");
      listItem.dataset.index = index; // Store index for easy reference
      listItem.classList.add("queue-item"); // Add class for styling
      listItem.innerHTML = `
                <span class="track-title">${song.name}</span>
                <button class="remove-btn" data-index="${index}"><i class="fas fa-times-circle"></i></button>
            `;
      if (index === currentSongIndex) {
        listItem.classList.add("current-song"); // Highlight current playing song
      }
      // Add event listener to play song when list item is clicked (unless it's the remove button)
      listItem.addEventListener("click", (e) => {
        if (
          !e.target.classList.contains("remove-btn") &&
          !e.target.closest(".remove-btn")
        ) {
          loadSong(index);
        }
      });
      playQueueList.appendChild(listItem);
    });

    // Add event listeners for dynamically created remove buttons
    document.querySelectorAll(".remove-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const indexToRemove = parseInt(
          e.target.dataset.index || e.target.closest("button").dataset.index
        );
        removeSongFromQueue(indexToRemove);
        e.stopPropagation(); // Prevent parent list item's click event from firing
      });
    });
  }

  /**
   * Removes a song from the play queue array and updates the UI.
   * Adjusts current song index if the playing song is removed.
   * @param {number} index - The index of the song to remove.
   */
  function removeSongFromQueue(index) {
    if (index > -1 && index < playQueue.length) {
      const removedSongName = playQueue[index].name;
      const wasPlaying = index === currentSongIndex;
      playQueue.splice(index, 1); // Remove song from array

      // Adjust currentSongIndex if the removed song was before or was the current one
      if (wasPlaying) {
        if (playQueue.length > 0) {
          loadSong(currentSongIndex % playQueue.length); // Load next song, or wrap around
        } else {
          // If queue is empty, reset player fully
          currentSongIndex = -1;
          audioPlayer.pause();
          audioPlayer.src = "";
          currentSongTitle.textContent = "No song playing";
          albumArtDisplay.src = "./images/default-album-art.png";
          playBtn.style.display = "inline-block";
          pauseBtn.style.display = "none";
          stopVisualizer();
        }
      } else if (index < currentSongIndex) {
        currentSongIndex--; // Adjust index if a song before the current one was removed
      }
      updatePlayQueueUI(); // Refresh the UI
      displayMessage(`Removed "${removedSongName}" from queue.`);
    }
  }

  /**
   * Updates the visual state of the favorite button based on the current song.
   */
  function updateFavoriteButton() {
    if (currentSongIndex === -1 || playQueue.length === 0) {
      favoriteBtn.classList.remove("active");
      return;
    }
    const currentSong = playQueue[currentSongIndex];
    const isLiked = likedSongs.some((song) => song.src === currentSong.src);
    favoriteBtn.classList.toggle("active", isLiked);
  }

  /**
   * Displays the list of liked songs in the Liked Songs section.
   * Allows playing and unliking songs from this list.
   */
  function displayLikedSongs() {
    likedSongsList.innerHTML = ""; // Clear current list
    if (likedSongs.length === 0) {
      likedSongsList.innerHTML =
        '<p class="empty-message">You haven\'t liked any songs yet.</p>';
      return;
    }

    likedSongs.forEach((song) => {
      const listItem = document.createElement("li");
      listItem.classList.add("liked-song-item"); // Add class for styling
      listItem.innerHTML = `
                <span class="song-title-liked">${song.name}</span>
                <button class="remove-liked-btn" data-src="${song.src}"><i class="fas fa-trash-alt"></i></button>
            `;
      // Add event listener to play liked song when clicked
      listItem.addEventListener("click", (e) => {
        if (
          !e.target.classList.contains("remove-liked-btn") &&
          !e.target.closest(".remove-liked-btn")
        ) {
          // Find the song in the main playQueue and load it
          const songIndexInQueue = playQueue.findIndex(
            (qSong) => qSong.src === song.src
          );
          if (songIndexInQueue !== -1) {
            loadSong(songIndexInQueue);
          } else {
            // If liked song is not in current queue, add it and play
            playQueue.push(song);
            loadSong(playQueue.length - 1); // Load the newly added song
          }
        }
      });
      likedSongsList.appendChild(listItem);
    });

    // Add event listeners for remove buttons in liked songs list
    document.querySelectorAll(".remove-liked-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const srcToRemove =
          e.target.dataset.src || e.target.closest("button").dataset.src;
        const removedSongName =
          likedSongs.find((song) => song.src === srcToRemove)?.name || "a song";
        likedSongs = likedSongs.filter((song) => song.src !== srcToRemove);
        localStorage.setItem("likedSongs", JSON.stringify(likedSongs));
        displayLikedSongs(); // Refresh liked songs list
        updateFavoriteButton(); // Update favorite button state if current song was unliked
        displayMessage(`Unliked "${removedSongName}".`);
        e.stopPropagation(); // Prevent parent li's click from firing
      });
    });
  }

  /**
   * Sets up or re-initializes the Web Audio API context and connects nodes
   * for visualizer and equalizer processing.
   */
  function setupAudioContext() {
    // Close existing context if it's running to prevent multiple contexts
    if (audioContext && audioContext.state !== "closed") {
      audioContext
        .close()
        .then(() => {
          console.log("Old AudioContext closed.");
          initializeNewAudioContext();
        })
        .catch((e) => console.error("Error closing audio context:", e));
    } else {
      initializeNewAudioContext();
    }
  }

  /**
   * Initializes a new Web Audio API context and sets up the audio graph.
   */
  function initializeNewAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Fast Fourier Transform size for frequency analysis
    dataArray = new Uint8Array(analyser.frequencyBinCount); // Array to hold frequency data

    // Create a source node from the HTML audio element only once
    if (!sourceNode) {
      sourceNode = audioContext.createMediaElementSource(audioPlayer);
    }
    // Disconnect previous connections from analyser if any before re-connecting
    // This prevents multiple connections if setupAudioContext is called multiple times
    analyser.disconnect();

    // Connect audio source to the analyser
    sourceNode.connect(analyser);

    // Connect analyser through EQ gain nodes to the destination (speakers)
    let lastNode = analyser;
    eqSliders.forEach((slider) => {
      const band = parseInt(slider.dataset.band);
      // Recreate gain node if it doesn't exist or context changed
      if (!gainNodes[band] || gainNodes[band].context !== audioContext) {
        gainNodes[band] = audioContext.createGain();
      }
      gainNodes[band].gain.value = parseFloat(slider.value); // Set initial gain from slider
      lastNode.connect(gainNodes[band]);
      lastNode = gainNodes[band];
    });
    lastNode.connect(audioContext.destination);
    console.log("New AudioContext and nodes set up.");
  }

  /**
   * Starts the audio visualizer animation loop.
   * Ensures AudioContext is resumed if suspended.
   */
  function startVisualizer() {
    if (!visualizerEnabled) return;

    if (!audioContext || audioContext.state === "closed") {
      setupAudioContext(); // Re-setup if closed
    }
    if (audioContext.state === "suspended") {
      audioContext
        .resume()
        .then(() => {
          console.log("AudioContext resumed successfully.");
        })
        .catch((e) => console.error("Error resuming audio context:", e));
    }

    visualizerCanvas.style.display = "block"; // Show the canvas
    visualizerPlaceholder.style.display = "none"; // Hide the placeholder

    const canvasCtx = visualizerCanvas.getContext("2d");
    // Set canvas dimensions to match container for responsiveness
    visualizerCanvas.width = visualizerCanvas.offsetWidth;
    visualizerCanvas.height = visualizerCanvas.offsetHeight;
    const WIDTH = visualizerCanvas.width;
    const HEIGHT = visualizerCanvas.height;

    /**
     * Draws a single frame of the visualizer. This function is called repeatedly.
     */
    function draw() {
      animationFrameId = requestAnimationFrame(draw);
      if (!analyser || !dataArray) {
        console.warn("Analyser or dataArray not initialized for visualizer.");
        return;
      }
      analyser.getByteFrequencyData(dataArray); // Get frequency data

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT); // Clear canvas for new frame

      const barWidth = (WIDTH / analyser.frequencyBinCount) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < analyser.frequencyBinCount; i++) {
        barHeight = dataArray[i] / 2;

        // Create a neon gradient for the bars
        const gradient = canvasCtx.createLinearGradient(0, HEIGHT, 0, 0);
        gradient.addColorStop(0, "#00FFFF"); // Electric blue
        gradient.addColorStop(1, "#FF00FF"); // Fuchsia
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    }
    draw(); // Start the drawing loop
  }

  /**
   * Stops the audio visualizer animation and hides the canvas.
   */
  function stopVisualizer() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    visualizerCanvas.style.display = "none";
    visualizerPlaceholder.style.display = "flex";
  }

  /**
   * Toggles the visualizer display on or off.
   */
  function toggleVisualizerDisplay() {
    visualizerEnabled = !visualizerEnabled;
    visualizerToggleBtn.classList.toggle("active", visualizerEnabled);
    if (visualizerEnabled && !audioPlayer.paused) {
      startVisualizer();
    } else {
      stopVisualizer();
    }
  }

  /**
   * Updates the gain values of the EQ frequency bands based on slider positions.
   */
  function updateGainNodes() {
    if (audioContext && audioContext.state === "running") {
      eqSliders.forEach((slider) => {
        const band = parseInt(slider.dataset.band);
        const value = parseFloat(slider.value);
        if (gainNodes[band]) {
          gainNodes[band].gain.value = value; // Apply gain (in dB)
        }
      });
    }
  }

  // --- 8. Initialization ---
  /**
   * Initializes the entire application when the DOM is loaded.
   * Sets up initial UI state and event listeners.
   */
  function initializeApp() {
    console.log("Timve App Initialized for Offline Use!");

    setupAudioContext(); // Set up audio context initially for potential visualizer/EQ
    setupEventListeners(); // Attach all event listeners

    // Set initial volume and update icon
    audioPlayer.volume = parseFloat(volumeSlider.value);
    updateVolumeIcon();

    // Show Home section by default and ensure right panel is visible
    showMainContentSection("homeSection");

    // Update play queue and favorite button states on load
    updatePlayQueueUI();
    updateFavoriteButton();

    // Ensure file input and custom upload button are hidden initially
    // They will be shown when navigating to the 'Play Queue' section
    if (fileInput) fileInput.style.display = "none";
    if (customUploadBtn) customUploadBtn.style.display = "none";
  }

  // Call the initialization function when the DOM content is fully loaded
  initializeApp();
});