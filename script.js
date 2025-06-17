// Global state
let currentUser = null;
const API_BASE_URL = 'http://localhost:3000/api';
const HUGGINGFACE_API_KEY = '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';

// Helper function for authenticated fetch requests
async function authFetch(url, options = {}) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No authentication token found');
            window.location.href = 'index.html';
            return null;
        }
        
        // Ensure headers object exists
        const headers = new Headers(options.headers || {});
        
        // Set Content-Type to JSON if not set and there's a body
        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        
        // Always add Authorization header
        headers.set('Authorization', `Bearer ${token}`);
        
        // Create fetch options with credentials for CORS
        const fetchOptions = {
            ...options,
            headers,
            credentials: 'include',
            mode: 'cors'
        };
        
        console.log(`Making request to ${url}`, {
            method: fetchOptions.method || 'GET',
            headers: Object.fromEntries(headers.entries()),
            hasBody: !!fetchOptions.body
        });
        
        const response = await fetch(url, fetchOptions);
        
        // Clone the response to read the body if needed
        const responseClone = response.clone();
        
        // Handle unauthorized responses
        if (response.status === 401) {
            console.error('Authentication failed - redirecting to login');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('token');
            window.location.href = 'index.html';
            return null;
        }
        
        // Log error responses for debugging
        if (!response.ok) {
            const errorText = await responseClone.text();
            console.error(`Request failed with status ${response.status}:`, errorText);
            throw new Error(`Request failed with status ${response.status}`);
        }
        
        return response;
    } catch (error) {
        console.error('Error in authFetch:', error);
        throw error;
    }
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check which page we're on and initialize accordingly
    if (document.getElementById('loginForm')) {
        setupLogin();
    } else if (document.querySelector('.dashboard-container')) {
        setupDashboard();
    } else if (document.getElementById('food-log-form')) {
        setupFoodLogPage();
    } else if (document.getElementById('food-search')) {
        setupCalorieChecker();
    } else if (document.getElementById('food-comparison')) {
        setupFoodComparison();
    }
    
    // Initialize common elements on all pages
    initializeCommonElements();
});

// Initialize common elements (user info, logout, mobile menu)
function initializeCommonElements() {
    // Load user info if logged in
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
        updateUserInfo();
    } else if (!document.getElementById('loginForm')) {
        // Redirect to login if not logged in (except on login page)
        window.location.href = 'index.html';
    }
    
    // Setup mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }
    
    // Setup logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        });
    }
    
    // Update current date in header
    updateCurrentDate();
}

// Login Page Setup
function setupLogin() {
    const loginForm = document.getElementById('loginForm');
    const errorContainer = document.getElementById('errorContainer');
    let submitBtn = null;
    let originalBtnText = '';
    
    // Clear any existing error messages when user starts typing
    const inputs = loginForm.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            errorContainer.textContent = '';
            errorContainer.style.display = 'none';
        });
    });
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Reset error state
        errorContainer.textContent = '';
        errorContainer.style.display = 'none';
        
        // Basic client-side validation
        if (!username || !password) {
            showError('Vul alstublieft zowel gebruikersnaam als wachtwoord in');
            return;
        }
        
        try {
            // Show loading state
            submitBtn = loginForm.querySelector('button[type="submit"]');
            originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inloggen...';
            
            // Call login API
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include', // Changed from 'same-origin' to 'include' for CORS
                mode: 'cors' // Explicitly set CORS mode
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Er is een fout opgetreden bij het inloggen');
            }
            
            if (data.success) {
                // Save user data and token to localStorage
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                
                // Show success message
                showSuccess(data.message || 'Inloggen gelukt!');
                
                // Small delay before redirect to show success message
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                throw new Error(data.message || 'Inloggen mislukt');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError(error.message || 'Er is een fout opgetreden. Probeer het later opnieuw.');
        } finally {
            // Reset button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    });
    
    // Helper function to show error messages
    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        errorContainer.focus();
    }
    
    // Helper function to show success messages
    function showSuccess(message) {
        errorContainer.textContent = message;
        errorContainer.style.color = '#28a745';
        errorContainer.style.display = 'block';
    }
}

// Dashboard Setup
function setupDashboard() {
    // Make sure currentUser is loaded
    const userData = localStorage.getItem('currentUser');
    if (userData) {
        currentUser = JSON.parse(userData);
    } else {
        // If no user is logged in, redirect to login
        window.location.href = 'index.html';
        return;
    }

    // Initialize user info and navigation
    updateUserInfo();
    setupNavigation();
    
    // Initialize user stats to 0 if they don't exist
    if (!currentUser.stats) {
        currentUser.stats = {
            points: 0,
            level: 1,
            streak: 0,
            avgScore: 0,
            totalCalories: 0
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
    
    // Load initial data
    loadDashboardData();
    loadTodaysFood();
    
    // Check for mobile view
    checkMobileView();
    window.addEventListener('resize', checkMobileView);
}

// Update user info in the sidebar
function updateUserInfo() {
    if (!currentUser) return;
    
    // Update sidebar user info
    const usernameElements = document.querySelectorAll('.username, #welcome-username');
    const classElements = document.querySelectorAll('.class-code, #leaderboard-class');
    
    usernameElements.forEach(el => {
        el.textContent = currentUser.username;
    });
    
    classElements.forEach(el => {
        el.textContent = `Klas: ${currentUser.classCode}`;
    });
}

// Setup navigation between pages
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    // Navigation map - maps data-page attributes to HTML files
    const pageMap = {
        'dashboard': 'dashboard.html',
        'food-log': 'food-loggen.html',
        'gallery': 'gallery.html',
        'calorie-checker': 'calorie-checker.html',
        'food-comparison': 'food-comparison.html',
        'help': 'vragen.html'
    };
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.getAttribute('data-page');
            
            // If it's the current page, just update the active state
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            if (pageMap[page] === currentPage) {
                updateActiveNavItem(item);
                return;
            }
            
            // Otherwise, navigate to the new page
            if (pageMap[page]) {
                window.location.href = pageMap[page];
            }
        });
    });
    
    // Update active nav item based on current page
    function updateActiveNavItem(activeItem) {
        navItems.forEach(nav => nav.classList.remove('active'));
        if (activeItem) {
            activeItem.classList.add('active');
        } else {
            // Try to find a matching nav item for the current page
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const pageName = Object.keys(pageMap).find(key => pageMap[key] === currentPage);
            if (pageName) {
                const matchingNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
                if (matchingNav) matchingNav.classList.add('active');
            }
        }
    }
    
    // Initialize active nav item
    updateActiveNavItem();
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }
    
    // Quick action buttons
    const quickLogFood = document.getElementById('quick-log-food');
    if (quickLogFood) {
        quickLogFood.addEventListener('click', () => {
            window.location.href = 'food-loggen.html';
        });
    }
    
    const quickCheckCalories = document.getElementById('quick-check-calories');
    if (quickCheckCalories) {
        quickCheckCalories.addEventListener('click', () => {
            // Find and click the calorie checker nav item
            const calorieNav = document.querySelector('.nav-item[data-page="calorie-checker"]');
            if (calorieNav) calorieNav.click();
        });
    }
}

// Setup event listeners for the dashboard
function setupEventListeners() {
    // Quick log food button
    const quickLogFoodBtn = document.getElementById('quick-log-food');
    if (quickLogFoodBtn) {
        quickLogFoodBtn.addEventListener('click', () => {
            // Switch to food log tab
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelector('.nav-item[data-page="food-log"]').classList.add('active');
            
            // Show food log page
            document.querySelectorAll('.page-content').forEach(page => {
                page.style.display = 'none';
            });
            document.getElementById('food-log-page').style.display = 'block';
            
            // Scroll to top
            window.scrollTo(0, 0);
            
            // Focus on food name input
            const foodNameInput = document.getElementById('food-name');
            if (foodNameInput) {
                foodNameInput.focus();
            }
        });
    }
    // Food log form
    const foodForm = document.getElementById('log-food-btn');
    if (foodForm) {
        foodForm.addEventListener('click', handleFoodLog);
    }
    
    // Image upload
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('food-image');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#3c8dbc';
            uploadArea.style.backgroundColor = '#f8fafc';
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = '#ddd';
            uploadArea.style.backgroundColor = 'transparent';
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '#ddd';
            uploadArea.style.backgroundColor = 'transparent';
            
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                handleImageUpload(fileInput.files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleImageUpload(e.target.files[0]);
            }
        });
    }
    
    // Mobile menu toggle (hamburger button would be added in the HTML)
    const menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    menuToggle.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('active');
    });
    
    const topBar = document.querySelector('.top-bar');
    if (topBar) {
        topBar.insertBefore(menuToggle, topBar.firstChild);
    }
}

// Setup food log page
function setupFoodLogPage() {
    const foodLogForm = document.getElementById('food-log-form');
    const foodImageInput = document.getElementById('food-image');
    
    if (foodLogForm) {
        foodLogForm.addEventListener('submit', handleFoodLog);
    }
    
    if (foodImageInput) {
        foodImageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
            }
        });
    }
    
    // Load today's food logs
    loadTodaysFood();
}

// Handle food log form submission
async function handleFoodLog(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showError('Je moet ingelogd zijn om voedsel toe te voegen');
        window.location.href = 'index.html';
        return;
    }
    
    const form = event.target;
    const formData = new FormData(form);
    const foodName = formData.get('foodName').trim();
    const amount = parseFloat(formData.get('amount')) || 0;
    const unit = 'g'; // Default unit
    const errorContainer = document.getElementById('error-container');
    const imageFile = formData.get('image');
    
    // Validate form
    if (!foodName) {
        showError('Voer een voedingsmiddel in', errorContainer);
        return;
    }
    
    if (amount <= 0) {
        showError('Voer een geldige hoeveelheid in', errorContainer);
        return;
    }
    
    try {
        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Bezig met verwerken...';
        
        // Clear any previous errors
        if (errorContainer) {
            errorContainer.style.display = 'none';
            errorContainer.textContent = '';
        }
        
        // Upload image if provided
        let imageUrl = '';
        if (imageFile && imageFile.size > 0) {
            try {
                imageUrl = await uploadImage(imageFile);
            } catch (error) {
                console.error('Error uploading image:', error);
                // Continue without image if upload fails
                imageUrl = '';
            }
        }
        
        // Get food score from HuggingFace
        const foodData = await fetchFoodScore(foodName);
        
        // Create food log object
        const foodLog = {
            foodName,
            amount,
            unit,
            score: foodData.score || 5, // Default to 5 if no score
            calories: foodData.calories || 0,
            healthTips: foodData.tips || [],
            imageUrl,
            timestamp: new Date().toISOString()
        };
        
        // Save food log to backend using authFetch
        const response = await authFetch(`${API_BASE_URL}/food-logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(foodLog)
        });
        
        if (!response) return; // authFetch handles redirection on 401
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Kon voedsel niet opslaan');
        }
        
        // Show success message
        showSuccess('Voedsel succesvol toegevoegd!', errorContainer);
        
        // Reset form
        form.reset();
        const imagePreview = document.getElementById('image-preview');
        if (imagePreview) imagePreview.style.display = 'none';
        
        // Refresh food logs and dashboard data
        await Promise.all([
            loadTodaysFood(),
            loadDashboardData()
        ]);
        
    } catch (error) {
        console.error('Error saving food log:', error);
        showError(error.message || 'Er is een fout opgetreden bij het opslaan', errorContainer);
    } finally {
        // Reset button state
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Voeg toe';
        }
    }
}

// Fetch food score using our backend API
async function fetchFoodScore(foodName) {
    try {
        // First try to get detailed nutrition information from our backend
        let nutritionData = null;

        try {
            const nutritionResponse = await fetch(`${API_BASE_URL}/food-info?name=${encodeURIComponent(foodName)}`);
            if (nutritionResponse.ok) {
                nutritionData = await nutritionResponse.json();
            }
        } catch (e) {
            console.warn('Could not fetch nutrition data:', e.message);
            // Continue without nutrition data
        }

        // Get the AI score from our backend
        const response = await authFetch(`${API_BASE_URL}/food-scoring`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ foodName })
        });

        if (!response) {
            // authFetch handles redirection on 401
            throw new Error('Niet ingelogd');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Kon geen score genereren');
        }

        const { score = 5.0, tips = [] } = await response.json();

        // If no tips were extracted, use some default tips
        let finalTips = tips;
        if (finalTips.length === 0) {
            if (score < 4) {
                finalTips = [
                    'Kies voor een gezonder alternatief',
                    'Eet dit met mate',
                    'Combineer met gezonde voedingsmiddelen'
                ];
            } else if (score < 7) {
                finalTips = [
                    'Kies voor de magere variant',
                    'Let op de portiegrootte',
                    'Combineer met verse groenten'
                ];
            } else {
                finalTips = [
                    'Uitestekende keuze!',
                    'Varieer met andere gezonde opties',
                    'Perfect als onderdeel van een gebalanceerd dieet'
                ];
            }
        }

        return {
            score: score,
            calories: nutritionData?.calories || calculateCalories(foodName, 100),
            tips: finalTips.slice(0, 3), // Return max 3 tips
            nutrition: nutritionData || {}
        };

    } catch (error) {
        console.error('Error fetching food score:', error);
        // Return default values if API call fails
        return {
            score: 5.0,
            calories: calculateCalories(foodName, 100),
            tips: [error.message || 'Kon geen voedingsinformatie ophalen. Probeer het later opnieuw.'],
            nutrition: {}
        };
    }
}

// Calculate calories based on food name and amount (simple estimation)
function calculateCalories(foodName, amount) {
    // This is a very simplified calculation
    // In a real app, you would use a food database API
    const food = foodName.toLowerCase();
    let caloriesPer100g = 100; // Default
    
    if (food.includes('appel') || food.includes('banaan') || food.includes('fruit')) {
        caloriesPer100g = 52;
    } else if (food.includes('brood') || food.includes('boterham')) {
        caloriesPer100g = 265;
    } else if (food.includes('kaas')) {
        caloriesPer100g = 402;
    } else if (food.includes('chips') || food.includes('snoep') || food.includes('koek')) {
        caloriesPer100g = 500;
    } else if (food.includes('groente') || food.includes('sla') || food.includes('komkommer')) {
        caloriesPer100g = 25;
    } else if (food.includes('kip') || food.includes('vlees')) {
        caloriesPer100g = 165;
    } else if (food.includes('vis')) {
        caloriesPer100g = 120;
    } else if (food.includes('pasta') || food.includes('rijst')) {
        caloriesPer100g = 130;
    }
    
    return Math.round((amount * caloriesPer100g) / 100);
}

// Get color based on food score (1-10)
function getScoreColor(score) {
    if (score >= 8) return '#2ecc71'; // Green
    if (score >= 6) return '#f1c40f'; // Yellow
    if (score >= 4) return '#e67e22'; // Orange
    return '#e74c3c'; // Red
}

// Upload image to server
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        // Use authFetch but override Content-Type for file upload
        const response = await authFetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
            headers: {
                // Don't set Content-Type, let the browser set it with the correct boundary
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response) return null; // authFetch handles redirection on 401
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Kon afbeelding niet uploaden');
        }
        
        const data = await response.json();
        return data.imageUrl || '';
        
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error(error.message || 'Kon afbeelding niet uploaden. Probeer het opnieuw.');
    }
}

// Handle image upload preview
function handleImageUpload(file) {
    const reader = new FileReader();
    const preview = document.getElementById('image-preview');
    
    if (!preview) return;
    
    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showError('Afbeelding is te groot. Maximale grootte is 5MB.');
        document.getElementById('food-image').value = '';
        return;
    }
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        showError('Ongeldig bestandstype. Gebruik JPEG, PNG of GIF.');
        document.getElementById('food-image').value = '';
        return;
    }
    
    reader.onload = function(e) {
        preview.innerHTML = `
            <div class="image-preview-container">
                <img src="${e.target.result}" alt="Preview" class="image-preview">
                <button type="button" class="remove-image" aria-label="Afbeelding verwijderen">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add event listener to remove button
        const removeBtn = preview.querySelector('.remove-image');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                preview.innerHTML = '';
                document.getElementById('food-image').value = '';
            });
        }
    };
    
    reader.onerror = function() {
        showError('Kon afbeelding niet laden. Probeer een andere afbeelding.');
    };
    
    reader.readAsDataURL(file);
}
async function loadTodaysFood() {
    if (!currentUser) return;
    
    const today = new Date().toISOString().split('T')[0];
    const foodList = document.getElementById('todays-food');
    
    try {
        // Show loading state
        foodList.innerHTML = '<div class="loading">Laden...</div>';
        
        // Fetch today's food logs from the backend using authFetch
        const response = await authFetch(`${API_BASE_URL}/food-logs?date=${today}`);
        
        if (!response) return; // authFetch handles redirection on 401
        
        if (!response.ok) {
            throw new Error('Kon voedselgeschiedenis niet ophalen');
        }
        
        let todaysLogs = await response.json();
        
        // Ensure we have an array and handle potential API response formats
        if (!Array.isArray(todaysLogs)) {
            console.warn('Expected array of food logs, got:', typeof todaysLogs, todaysLogs);
            if (todaysLogs && todaysLogs.data && Array.isArray(todaysLogs.data)) {
                // Handle case where logs are nested in a data property
                todaysLogs = todaysLogs.data;
            } else if (todaysLogs && todaysLogs.logs && Array.isArray(todaysLogs.logs)) {
                // Handle case where logs are nested in a logs property
                todaysLogs = todaysLogs.logs;
            } else {
                // If we still don't have an array, set to empty array
                todaysLogs = [];
            }
        }
        
        // Filter out any invalid log entries
        const validLogs = todaysLogs.filter(log => {
            const isValid = log && 
                         typeof log === 'object' && 
                         log.foodName && 
                         log.timestamp;
            if (!isValid) {
                console.warn('Skipping invalid food log entry:', log);
            }
            return isValid;
        });
        
        if (validLogs.length === 0) {
            foodList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-utensils"></i>
                    <p>Nog niets gegeten vandaag</p>
                </div>
            `;
            return;
        }
        
        // Generate food list HTML
        foodList.innerHTML = validLogs.map(log => `
            <div class="food-log-item">
                <div class="food-log-info">
                    <h4>${log.foodName}</h4>
                    <div class="food-log-meta">
                        <span class="food-log-time">${new Date(log.timestamp).toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit'})}</span>
                        <span class="food-log-score" style="background-color: ${getScoreColor(log.score)}">${log.score.toFixed(1)}</span>
                    </div>
                </div>
                <div class="food-log-actions">
                    <span class="food-log-calories">${Math.round(log.calories || 0)} kcal</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading food logs:', error);
        showError('Kon voedselgeschiedenis niet laden. Probeer het later opnieuw.');
        
        // Show empty state on error
        foodList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Kan voedselgeschiedenis niet laden</p>
            </div>
        `;
    }
}

// Load dashboard data
async function loadDashboardData() {
    if (!currentUser) return;
    
    try {
        // Fetch user stats from the backend using authFetch
        const response = await authFetch(`${API_BASE_URL}/users/${currentUser.username}/stats`);
        
        if (!response) return; // authFetch handles redirection on 401
        
        if (!response.ok) {
            throw new Error('Kon statistieken niet ophalen');
        }
        
        const stats = await response.json();
        
        // Update the UI with the stats
        if (document.getElementById('total-points')) {
            document.getElementById('total-points').textContent = Math.floor(stats.points || 0);
        }
        if (document.getElementById('current-level')) {
            document.getElementById('current-level').textContent = stats.level || 1;
        }
        if (document.getElementById('streak-days')) {
            document.getElementById('streak-days').textContent = stats.streak || 0;
        }
        if (document.getElementById('avg-score')) {
            document.getElementById('avg-score').textContent = (stats.avgScore || 0).toFixed(1);
        }
        if (document.getElementById('total-calories')) {
            document.getElementById('total-calories').textContent = Math.floor(stats.totalCalories || 0);
        }
        
        // Update progress bar (assuming 100 points per level for now)
        const progressBar = document.getElementById('level-progress');
        if (progressBar) {
            const progressPercent = (stats.points % 100) || 0;
            progressBar.style.width = `${progressPercent}%`;
        }
        
        // Load today's food logs and update leaderboard
        await Promise.all([
            loadTodaysFood(),
            updateLeaderboard()
        ]);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Kon dashboardgegevens niet laden. Probeer het later opnieuw.');
    }
}

// Update leaderboard with data from backend
async function updateLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;
    
    try {
        // Fetch leaderboard data from the backend using authFetch
        const response = await authFetch(`${API_BASE_URL}/leaderboard`);
        
        if (!response) return; // authFetch handles redirection on 401
        
        if (!response.ok) {
            throw new Error('Kon de ranglijst niet laden');
        }
        
        const leaderboard = await response.json();
        
        // Clear existing content
        leaderboardList.innerHTML = '';
        
        if (!leaderboard || leaderboard.length === 0) {
            leaderboardList.innerHTML = '<li class="no-entries">Nog geen ranglijst beschikbaar</li>';
            return;
        }
        
        // Add each user to the leaderboard
        leaderboard.forEach((user, index) => {
            const position = index + 1;
            const listItem = document.createElement('li');
            listItem.className = 'leaderboard-item';
            
            // Highlight current user
            if (currentUser && user.username === currentUser.username) {
                listItem.classList.add('current-user');
            }
            
            // Add medal emoji for top 3
            let positionText = `${position}.`;
            if (position === 1) positionText = '🥇';
            else if (position === 2) positionText = '🥈';
            else if (position === 3) positionText = '🥉';
            
            listItem.innerHTML = `
                <span class="position">${positionText}</span>
                <span class="user">${user.username || 'Onbekende gebruiker'}</span>
                <span class="points">${Math.floor(user.points || 0)} punten</span>
            `;
            
            leaderboardList.appendChild(listItem);
        });
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboardList.innerHTML = '<li class="error">Kon de ranglijst niet laden: ' + (error.message || 'Onbekende fout') + '</li>';
    }
}

// Show success message in the specified container
function showSuccess(message, container) {
    if (!container) {
        console.log('Success:', message);
        return;
    }
    
    // Clear any existing messages
    const existingMessages = container.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => {
        if (msg.parentNode === container) {
            container.removeChild(msg);
        }
    });
    
    // Create and show success message
    const successElement = document.createElement('div');
    successElement.className = 'success-message';
    successElement.innerHTML = `
        <div class="success-content">
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        </div>
        <button class="close-message">&times;</button>
    `;
    
    // Add close button functionality
    const closeButton = successElement.querySelector('.close-message');
    closeButton.addEventListener('click', () => {
        successElement.style.display = 'none';
    });
    
    container.prepend(successElement);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (successElement.parentNode === container) {
            successElement.style.opacity = '0';
            setTimeout(() => {
                if (successElement.parentNode === container) {
                    container.removeChild(successElement);
                }
            }, 300);
        }
    }, 5000);
}

// Show error message in the specified container
function showError(message, container) {
    if (!container) {
        console.error('Error container not found for message:', message);
        return;
    }
    
    // Clear any existing messages
    const existingMessages = container.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => {
        if (msg.parentNode === container) {
            container.removeChild(msg);
        }
    });
    
    // Create and show error message
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        </div>
        <button class="close-message">&times;</button>
    `;
    
    // Add close button functionality
    const closeButton = errorElement.querySelector('.close-message');
    closeButton.addEventListener('click', () => {
        errorElement.style.display = 'none';
    });
    
    container.prepend(errorElement);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorElement.parentNode === container) {
            errorElement.style.opacity = '0';
            setTimeout(() => {
                if (errorElement.parentNode === container) {
                    container.removeChild(errorElement);
                }
            }, 300);
        }
    }, 5000);
}

// Update current date in the header
function updateCurrentDate() {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'Europe/Amsterdam' // Ensure we use Dutch timezone
    };
    
    const now = new Date();
    const formattedDate = now.toLocaleDateString('nl-NL', options);
    
    const dateElements = document.querySelectorAll('.current-date, #current-date');
    dateElements.forEach(el => {
        el.textContent = formattedDate;
        el.setAttribute('aria-live', 'polite');
    });
    
    // Also update any time elements if they exist
    const timeOptions = { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' };
    const formattedTime = now.toLocaleTimeString('nl-NL', timeOptions);
    document.querySelectorAll('.current-time').forEach(el => {
        el.textContent = formattedTime;
        el.setAttribute('datetime', now.toISOString());
    });
}

// Check if we're on mobile view
function checkMobileView() {
    const isMobile = window.innerWidth <= 768;
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    
    if (isMobile) {
        sidebar.classList.add('mobile');
        sidebar.classList.remove('active');
        if (menuToggle) menuToggle.style.display = 'block';
    } else {
        sidebar.classList.remove('mobile');
        sidebar.classList.add('active');
        if (menuToggle) menuToggle.style.display = 'none';
    }
    
    // Dispatch custom event for other components to react to
    window.dispatchEvent(new CustomEvent('viewChange', { detail: { isMobile } }));
}
