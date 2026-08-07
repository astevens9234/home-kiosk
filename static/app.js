/**
 * Pi Kiosk Dashboard UI Controller
 * Core JavaScript logic for updates, API polling, charting, and event rendering.
 */

// Configuration
const CONFIG = {
    weather: {
        latitude: 33.4350, // Goodyear, AZ
        longitude: -112.3577,
        unit: 'fahrenheit' // 'celsius' or 'fahrenheit'
    },
    pollingIntervals: {
        clock: 1000,
        metrics: 3000,
        weather: 600000, // 10 minutes
        calendar: 60000 // 1 minute
    }
};

// Application State
const STATE = {
    metricsHistory: {
        cpu: [],
        memory: [],
        limit: 20
    },
    setupPanelClosed: localStorage.getItem('setup_panel_closed') === 'true',
    weatherCodeMap: {
        0: { desc: 'Clear sky', icon: 'sun' },
        1: { desc: 'Mainly clear', icon: 'cloud-sun' },
        2: { desc: 'Partly cloudy', icon: 'cloud-sun' },
        3: { desc: 'Overcast', icon: 'cloud' },
        45: { desc: 'Foggy', icon: 'cloud-drizzle' },
        48: { desc: 'Depositing rime fog', icon: 'cloud-drizzle' },
        51: { desc: 'Light drizzle', icon: 'cloud-drizzle' },
        53: { desc: 'Moderate drizzle', icon: 'cloud-drizzle' },
        55: { desc: 'Dense drizzle', icon: 'cloud-drizzle' },
        56: { desc: 'Light freezing drizzle', icon: 'cloud-drizzle' },
        57: { desc: 'Dense freezing drizzle', icon: 'cloud-drizzle' },
        61: { desc: 'Slight rain', icon: 'cloud-rain' },
        63: { desc: 'Moderate rain', icon: 'cloud-rain' },
        65: { desc: 'Heavy rain', icon: 'cloud-rain' },
        66: { desc: 'Light freezing rain', icon: 'cloud-rain' },
        67: { desc: 'Heavy freezing rain', icon: 'cloud-rain' },
        71: { desc: 'Slight snow fall', icon: 'snowflake' },
        73: { desc: 'Moderate snow fall', icon: 'snowflake' },
        75: { desc: 'Heavy snow fall', icon: 'snowflake' },
        77: { desc: 'Snow grains', icon: 'snowflake' },
        80: { desc: 'Slight rain showers', icon: 'cloud-rain' },
        81: { desc: 'Moderate rain showers', icon: 'cloud-rain' },
        82: { desc: 'Violent rain showers', icon: 'cloud-lightning' },
        85: { desc: 'Slight snow showers', icon: 'snowflake' },
        86: { desc: 'Heavy snow showers', icon: 'snowflake' },
        95: { desc: 'Thunderstorm', icon: 'cloud-lightning' },
        96: { desc: 'Thunderstorm with slight hail', icon: 'cloud-lightning' },
        99: { desc: 'Thunderstorm with heavy hail', icon: 'cloud-lightning' }
    }
};

// Canvas Chart Helper
let chartCanvas, ctx;

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize icons
    lucide.createIcons();

    // Check Local Storage for Dim Mode preference
    if (localStorage.getItem('dim_mode') === 'true') {
        document.body.classList.add('dimmed');
        updateDimButtonIcon(true);
    }

    // Set up canvas elements
    initCanvas();

    // Start Clock
    updateClock();
    setInterval(updateClock, CONFIG.pollingIntervals.clock);

    // Initial Data Fetches
    fetchMetrics();
    fetchWeather();
    fetchCalendar();

    // Start Polling Intervals
    setInterval(fetchMetrics, CONFIG.pollingIntervals.metrics);
    setInterval(fetchWeather, CONFIG.pollingIntervals.weather);
    setInterval(fetchCalendar, CONFIG.pollingIntervals.calendar);

    // Network status monitoring
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Event Listeners
    setupEventListeners();
});

/* ==========================================================================
   EVENT LISTENERS Setup
   ========================================================================== */
function setupEventListeners() {
    // Dim Mode Toggle
    document.getElementById('btn-toggle-dim').addEventListener('click', () => {
        const isDimmed = document.body.classList.toggle('dimmed');
        localStorage.setItem('dim_mode', isDimmed);
        updateDimButtonIcon(isDimmed);
    });

    // App Reload
    document.getElementById('btn-reload-all').addEventListener('click', () => {
        location.reload();
    });

    // Calendar refresh
    const refreshBtn = document.getElementById('btn-refresh-calendar');
    refreshBtn.addEventListener('click', () => {
        // Spin icon
        const icon = refreshBtn.querySelector('i');
        icon.style.transform = 'rotate(360deg)';
        icon.style.transition = 'transform 0.8s ease';
        
        fetchCalendar().finally(() => {
            setTimeout(() => {
                icon.style.transform = 'none';
                icon.style.transition = 'none';
            }, 800);
        });
    });

    // Setup helper visibility toggles
    const setupPanel = document.getElementById('setup-panel');
    
    document.getElementById('btn-show-setup').addEventListener('click', () => {
        setupPanel.classList.toggle('hidden');
    });

    document.getElementById('btn-close-setup').addEventListener('click', () => {
        setupPanel.classList.add('hidden');
        localStorage.setItem('setup_panel_closed', 'true');
        STATE.setupPanelClosed = true;
    });

    // Handle canvas resize on screen orientation changes
    window.addEventListener('resize', () => {
        resizeCanvas();
        drawMetricsChart();
    });
}

function updateDimButtonIcon(isDimmed) {
    const btn = document.getElementById('btn-toggle-dim');
    if (isDimmed) {
        btn.innerHTML = '<i data-lucide="sun"></i>';
    } else {
        btn.innerHTML = '<i data-lucide="moon"></i>';
    }
    lucide.createIcons({ attrs: { class: 'lucide' } });
}

/* ==========================================================================
   NETWORK STATUS
   ========================================================================== */
function updateNetworkStatus() {
    const badge = document.getElementById('net-status');
    const text = document.getElementById('net-status-text');
    
    // Lucide replaces <i> with <svg class="lucide ..."> on initialization,
    // so we find either the existing SVG icon or the fallback <i> icon tag.
    const icon = badge.querySelector('.lucide') || badge.querySelector('i');
    
    if (navigator.onLine) {
        badge.className = 'status-badge online';
        text.textContent = 'Network Online';
        if (icon) {
            icon.outerHTML = '<i data-lucide="wifi" class="icon-small"></i>';
        }
    } else {
        badge.className = 'status-badge offline';
        text.textContent = 'Disconnected';
        if (icon) {
            icon.outerHTML = '<i data-lucide="wifi-off" class="icon-small"></i>';
        }
    }
    lucide.createIcons();
}

/* ==========================================================================
   CLOCK & DATE SYSTEM
   ========================================================================== */
function updateClock() {
    const now = new Date();
    
    // Time formatting (24h clock with padded elements)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('clock').innerHTML = `${hours}<span class="clock-colon">:</span>${minutes}<span class="clock-colon">:</span>${seconds}`;
    
    // Date formatting
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    document.getElementById('day-name').textContent = days[now.getDay()];
    document.getElementById('date-string').textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

/* ==========================================================================
   WEATHER SERVICE (Open-Meteo Integration)
   ========================================================================== */
async function fetchWeather() {
    try {
        const lat = CONFIG.weather.latitude;
        const lon = CONFIG.weather.longitude;
        const tempUnit = CONFIG.weather.unit;
        
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&temperature_unit=${tempUnit}&timezone=auto`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Weather fetch failed');
        const data = await response.json();
        
        updateWeatherUI(data);
    } catch (error) {
        console.error('Weather error:', error);
        document.getElementById('weather-description').textContent = 'Unable to sync weather data';
    }
}

function updateWeatherUI(data) {
    const cur = data.current_weather;
    const daily = data.daily;
    
    // Current Weather
    const currentTemp = Math.round(cur.temperature);
    const weatherInfo = STATE.weatherCodeMap[cur.weathercode] || { desc: 'Unknown', icon: 'cloud' };
    
    document.getElementById('current-temp').textContent = currentTemp;
    document.getElementById('weather-description').textContent = weatherInfo.desc;
    
    // Update weather large icon
    const iconContainer = document.getElementById('weather-icon-container');
    iconContainer.innerHTML = `<i data-lucide="${weatherInfo.icon}" class="icon-large animated-weather"></i>`;
    
    // 3-Day Forecast
    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = '';
    
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Fetch days 1, 2, and 3 (excluding index 0 which is today)
    for (let i = 1; i <= 3; i++) {
        const dateStr = daily.time[i];
        const dateObj = new Date(dateStr + 'T00:00:00'); // Prevent local timezone offset shift
        const dayName = dayLabels[dateObj.getDay()];
        
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const code = daily.weathercode[i];
        const forecastInfo = STATE.weatherCodeMap[code] || { desc: 'Cloudy', icon: 'cloud' };
        
        const forecastEl = document.createElement('div');
        forecastEl.className = 'forecast-day';
        forecastEl.innerHTML = `
            <span class="forecast-name">${dayName}</span>
            <i data-lucide="${forecastInfo.icon}" class="forecast-icon icon-medium"></i>
            <span class="forecast-temp">${maxTemp}° / ${minTemp}°</span>
        `;
        forecastContainer.appendChild(forecastEl);
    }
    
    // Re-trigger icon rendering
    lucide.createIcons();
}

/* ==========================================================================
   SYSTEM STATS SERVICE & LIGHTWEIGHT CANVAS CHARTING
   ========================================================================== */
async function fetchMetrics() {
    try {
        const response = await fetch('/api/metrics');
        if (!response.ok) throw new Error('Metrics API error');
        const data = await response.json();
        
        // Update DOM stats elements
        document.getElementById('cpu-value').textContent = `${Math.round(data.cpu_usage)}%`;
        document.getElementById('cpu-bar').style.width = `${data.cpu_usage}%`;
        
        document.getElementById('mem-value').textContent = `${data.memory_used_gb} / ${data.memory_total_gb} GB`;
        document.getElementById('mem-bar').style.width = `${data.memory_usage}%`;
        
        document.getElementById('disk-value').textContent = `${Math.round(data.disk_usage)}%`;
        document.getElementById('disk-bar').style.width = `${data.disk_usage}%`;
        
        document.getElementById('uptime-text').textContent = `Uptime: ${data.uptime}`;
        
        // Temperature badge update
        const tempText = document.getElementById('pi-temp-text');
        const tempBadge = document.getElementById('pi-temp-badge');
        tempText.textContent = `${data.cpu_temp.toFixed(1)}°C`;
        
        if (data.cpu_temp >= 68.0) {
            tempBadge.className = 'status-badge hot';
        } else {
            tempBadge.className = 'status-badge';
            tempBadge.style.color = ''; // Reset custom class colors if any
        }
        
        // Save values to charting history
        STATE.metricsHistory.cpu.push(data.cpu_usage);
        STATE.metricsHistory.memory.push(data.memory_usage);
        
        // Trim history
        if (STATE.metricsHistory.cpu.length > STATE.metricsHistory.limit) {
            STATE.metricsHistory.cpu.shift();
            STATE.metricsHistory.memory.shift();
        }
        
        // Redraw high-perf canvas graph
        drawMetricsChart();
    } catch (error) {
        console.error('Metrics fetch error:', error);
    }
}

function initCanvas() {
    chartCanvas = document.getElementById('metricsChart');
    ctx = chartCanvas.getContext('2d');
    resizeCanvas();
}

function resizeCanvas() {
    if (!chartCanvas) return;
    
    // Scale canvas pixels for HDPI / Retina displays to make lines super sharp
    const dpr = window.devicePixelRatio || 1;
    const rect = chartCanvas.getBoundingClientRect();
    
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
}

function drawMetricsChart() {
    if (!ctx || !chartCanvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = chartCanvas.width / dpr;
    const height = chartCanvas.height / dpr;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const cpuData = STATE.metricsHistory.cpu;
    const memData = STATE.metricsHistory.memory;
    const maxPoints = STATE.metricsHistory.limit;
    
    if (cpuData.length < 2) return;
    
    // 1. Draw horizontal faint grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    
    const gridRows = 3;
    for (let i = 1; i <= gridRows; i++) {
        const y = (height / (gridRows + 1)) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Helper function to plot a line dataset
    const drawDataset = (data, color, fillGradStart) => {
        ctx.beginPath();
        
        // Calculate points coordinates
        const points = data.map((val, idx) => {
            const x = (idx / (maxPoints - 1)) * width;
            // Invert Y coordinate (0 load is bottom, 100 load is top)
            const y = height - (val / 100.0) * (height - 8) - 4; // Padding
            return { x, y };
        });
        
        // Draw smooth bezier curve or line segments
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.0;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Draw fill under the line
        ctx.lineTo(points[points.length - 1].x, height);
        ctx.lineTo(points[0].x, height);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, fillGradStart);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw small dot on last point
        const last = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    };
    
    // Draw Memory line first (blue)
    drawDataset(memData, '#3b82f6', 'rgba(59, 130, 246, 0.12)');
    
    // Draw CPU line second (purple)
    drawDataset(cpuData, '#8b5cf6', 'rgba(139, 92, 246, 0.16)');
}

/* ==========================================================================
   GOOGLE CALENDAR API SERVICE
   ========================================================================== */
async function fetchCalendar() {
    try {
        const response = await fetch('/api/calendar');
        if (!response.ok) throw new Error('Calendar API error');
        const data = await response.json();
        
        updateCalendarUI(data);
    } catch (error) {
        console.error('Calendar sync error:', error);
        
        // Show error status badge
        const badge = document.getElementById('calendar-status');
        badge.className = 'connection-badge error';
        document.getElementById('calendar-status-text').textContent = 'Sync Error';
    }
}

function updateCalendarUI(data) {
    const badge = document.getElementById('calendar-status');
    const badgeText = document.getElementById('calendar-status-text');
    const setupPanel = document.getElementById('setup-panel');
    const container = document.getElementById('calendar-events-container');
    
    // 1. Connection Status display
    if (data.status === 'connected') {
        badge.className = 'connection-badge connected';
        badgeText.textContent = 'Calendar Live';
        setupPanel.classList.add('hidden'); // Auto hide if connected
    } else if (data.status === 'demo') {
        badge.className = 'connection-badge demo';
        badgeText.textContent = 'Demo Mode';
        
        // Show setup panel if it wasn't explicitly closed by user
        if (!STATE.setupPanelClosed) {
            setupPanel.classList.remove('hidden');
        }
        
        // Check credentials json status badge inside helper panel
        const credBadge = document.getElementById('setup-cred-badge');
        if (data.has_credentials_json) {
            credBadge.className = 'setup-badge found';
            credBadge.innerHTML = '<i data-lucide="check-circle-2" class="icon-small"></i> credentials.json found';
        } else {
            credBadge.className = 'setup-badge';
            credBadge.innerHTML = '<i data-lucide="alert-circle" class="icon-small"></i> credentials.json missing';
        }
    } else {
        badge.className = 'connection-badge error';
        badgeText.textContent = 'Sync Alert';
    }
    
    // 2. Render Calendar Events
    container.innerHTML = '';
    const events = data.events || [];
    
    if (events.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-range" class="icon-large"></i>
                <span>No upcoming events scheduled</span>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    const now = new Date();
    
    events.forEach(event => {
        // Parse date objects
        let startObj, isAllDay = false;
        
        if (event.start.dateTime) {
            startObj = new Date(event.start.dateTime);
        } else if (event.start.date) {
            startObj = new Date(event.start.date + 'T00:00:00');
            isAllDay = true;
        } else {
            return; // invalid event
        }
        
        // Format Date details
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        const monthLabel = months[startObj.getMonth()];
        const dateNum = startObj.getDate();
        const dayLabel = days[startObj.getDay()];
        
        // Time ranges
        let timeRangeText = '';
        if (isAllDay) {
            timeRangeText = 'All Day';
        } else {
            const endObj = event.end && event.end.dateTime ? new Date(event.end.dateTime) : null;
            const startTimeStr = formatTime(startObj);
            
            if (endObj) {
                const endTimeStr = formatTime(endObj);
                timeRangeText = `${startTimeStr} - ${endTimeStr}`;
            } else {
                timeRangeText = startTimeStr;
            }
        }
        
        // Determine if event is Today
        const isToday = startObj.getFullYear() === now.getFullYear() &&
                        startObj.getMonth() === now.getMonth() &&
                        startObj.getDate() === now.getDate();
                        
        // Category color (Google Calendar colorId map)
        const colorClass = event.colorId ? `cat-${event.colorId}` : 'cat-default';
        const todayClass = isToday ? 'today-event' : '';
        
        const eventCard = document.createElement('div');
        eventCard.className = `event-item ${colorClass} ${todayClass}`;
        
        // Build card HTML
        eventCard.innerHTML = `
            <div class="event-date-box">
                <span class="event-date-month">${monthLabel}</span>
                <span class="event-date-num">${dateNum}</span>
                <span class="event-date-day">${dayLabel}</span>
            </div>
            <div class="event-details">
                <h4 class="event-title">${event.summary}</h4>
                <div class="event-time-loc">
                    <div class="event-meta-item time">
                        <i data-lucide="clock" class="icon-small"></i>
                        <span>${timeRangeText}</span>
                    </div>
                    ${event.location ? `
                        <div class="event-meta-item location">
                            <i data-lucide="map-pin" class="icon-small"></i>
                            <span>${event.location}</span>
                        </div>
                    ` : ''}
                </div>
                ${event.description ? `<p class="event-desc">${event.description}</p>` : ''}
            </div>
        `;
        
        container.appendChild(eventCard);
    });
    
    lucide.createIcons();
}

function formatTime(dateObj) {
    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // block "0" to be "12"
    
    return `${hours}:${minutes} ${ampm}`;
}
