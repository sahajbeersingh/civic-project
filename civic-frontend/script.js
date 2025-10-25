// CONFIGURATION
const BACKEND_URL = "https://civic-backend-api.onrender.com"; 
const ADMIN_SECRET_KEY = "municipal123";

// STATE AND UTILITIES
let currentView = 'user';
let mapUser = null;
let mapAdmin = null;
let userMarker = null;
let adminMarkers = L.layerGroup();
let currentComplaintLocation = { lat: 30.74, long: 76.78 }; // Default location

// Admin state
const adminState = {
    page: 1,
    limit: 10,
    filterStatus: 'pending',
    isLoading: false,
    hasMore: true,
    allLoadedComplaints: []
};
 
// Persistent user ID
const tempUserId = (() => {
    let id = localStorage.getItem('tempUserId');
    if (!id) {
        id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('tempUserId', id);
    }
    return id;
})();
 
// Priority styling info
function getPriorityInfo(priority) {
    const p = parseInt(priority, 10);
    let label = 'LOW';
    let className = 'priority-low';
    
    if (p === 3) {
        label = 'HIGH';
        className = 'priority-high';
    } else if (p === 2) {
        label = 'MEDIUM';
        className = 'priority-medium';
    }

    return { label, className };
}

// Map icons
function getPriorityIcon(priority) {
    const pInfo = getPriorityInfo(priority);
    let colorCode = '#3b82f6'; 
    
    if (pInfo.label === 'HIGH') {
        colorCode = '#dc2626'; 
    } else if (pInfo.label === 'MEDIUM') {
        colorCode = '#ca8a04'; 
    }

    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${colorCode}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 6px rgba(0,0,0,0.6);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -11]
    });
}

// Core API fetch
async function apiFetch(endpoint, options = {}) {
    let response;
    const url = endpoint.startsWith('http') ? endpoint : `${BACKEND_URL}${endpoint}`;
    
    try {
        const defaultHeaders = { 'Accept': 'application/json' };
        
        if (options.body instanceof FormData) {
            delete defaultHeaders['Content-Type'];
        } else if (options.body && typeof options.body === 'string') {
            defaultHeaders['Content-Type'] = 'application/json';
        }

        response = await fetch(url, {
            ...options,
            headers: { ...defaultHeaders, ...options.headers },
            mode: 'cors',
            credentials: 'omit'
        });

        if (!response.ok) {
            const errorText = await response.text();
            const status = response.status;
            let preview = errorText.substring(0, 100).trim();
            if (preview.startsWith('<!DOCTYPE')) {
                preview = "HTML page returned";
            }
            console.error(`API Fetch Error on ${url}: Status ${status}`, { response: errorText });
            throw new Error(`API Error on ${url} (Status: ${status}): ${preview}`);
        }
        
        try {
            return await response.json();
        } catch (e) {
            if (response.status === 204) return {}; 
            throw new Error(`Failed to parse JSON response from ${url}.`);
        }

    } catch (error) {
        console.error(`Network error fetching ${url}:`, error);
        
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error(`Connection Error: Failed to reach the server. Likely CORS or server is down.`);
        }
        
        throw error;
    }
}

// User map
function initializeUserMap() {
    if (mapUser) mapUser.remove();
    
    mapUser = L.map('mapUser').setView([currentComplaintLocation.lat, currentComplaintLocation.long], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapUser);

    // Marker
    userMarker = L.marker([currentComplaintLocation.lat, currentComplaintLocation.long]).addTo(mapUser)
        .bindPopup("Your complaint location").openPopup();
    
    // Geolocation
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            currentComplaintLocation = { lat: latitude, long: longitude };
            mapUser.setView([latitude, longitude], 15);
            userMarker.setLatLng([latitude, longitude]);
            document.getElementById('locationCoords').value = `${latitude}, ${longitude}`;
        },
        (err) => {
            console.warn(`Geolocation failed: ${err.message}. Using default.`);
            document.getElementById('locationCoords').value = `${currentComplaintLocation.lat}, ${currentComplaintLocation.long}`;
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

// Admin map
function initializeAdminMap(complaints) {
    if (mapAdmin) mapAdmin.remove();
    
    const defaultView = complaints.length > 0
        ? [complaints[0].location_lat, complaints[0].location_long]
        : [30.74, 76.78]; 
    
    mapAdmin = L.map('mapAdmin').setView(defaultView, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapAdmin);
    
    adminMarkers.clearLayers();
    
    const COORDS_JITTER = 0.002;
    const coordsMap = new Map();
    
    complaints.forEach(c => {
        if (c.location_lat && c.location_long) {
            const coordKey = `${c.location_lat},${c.location_long}`;
            let lat = c.location_lat;
            let long = c.location_long;

            if (coordsMap.has(coordKey)) {
                // Apply jitter
                lat += (Math.random() - 0.5) * COORDS_JITTER;
                long += (Math.random() - 0.5) * COORDS_JITTER;
            }
            coordsMap.set(coordKey, true);
            
            const priorityInfo = getPriorityInfo(c.priority);
            const icon = getPriorityIcon(c.priority);
            
            const marker = L.marker([lat, long], { icon: icon }).addTo(mapAdmin)
                .bindPopup(`<b>Complaint #${c.id}</b><br>Priority: ${priorityInfo.label}<br>${c.title}<br>Status: ${c.status}`);
            adminMarkers.addLayer(marker);
        }
    });
    adminMarkers.addTo(mapAdmin);
    
    // Force map to recalculate its size
    mapAdmin.invalidateSize();

    if (adminMarkers.getLayers().length > 0) {
        try {
            const bounds = adminMarkers.getBounds();
            mapAdmin.fitBounds(bounds, { padding: [20, 20] });
        } catch(e) {
            console.warn("Error calculating map bounds, using default view.", e);
            mapAdmin.setView(defaultView, 12);
        }
    } else {
        mapAdmin.setView(defaultView, 12);
    }
}

// Handle new complaint
async function handleAddComplaint(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<div class="loader"></div> Submitting...';

    const title = form.title.value;
    const description = form.description.value;
    const imageFile = form.image.files[0];
    const [lat, long] = form.locationCoords.value.split(',').map(s => s.trim());
    
    if (!lat || !long) {
        alert('Location coordinates are missing.');
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Complaint';
        return;
    }

    let imageUrl = null;
    
    try {
        // Image Upload
        if (imageFile) {
            const formData = new FormData();
            formData.append('image', imageFile);
            
            const uploadData = await apiFetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (uploadData.success && uploadData.image_url) {
                imageUrl = uploadData.image_url;
            } else {
                throw new Error("Image upload failed or missing 'image_url'.");
            }
        }

        // Complaint Submission
        const complaintPayload = {
            title: title,
            description: description,
            location_lat: parseFloat(lat),
            location_long: parseFloat(long),
            image_url: imageUrl,
            user_id: tempUserId,
        };

        await apiFetch('/api/complaints', {
            method: 'POST',
            body: JSON.stringify(complaintPayload),
        });

        alert('Complaint submitted successfully!');
        form.reset();
        renderView('user');

    } catch (error) {
        alert(`Complaint submission failed: ${error.message}`);
        console.error("Submission error:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Complaint';
    }
}

// Fetch complaints logic
async function fetchComplaints(fetchType, identifier = null) {
    let endpoint = '/api/complaints';
    let queryParams = [];

    if (fetchType === 'user') {
        queryParams.push(`user_id=${identifier}`);
    } else if (fetchType === 'admin') {
        queryParams.push(`page=${adminState.page}`);
        queryParams.push(`limit=${adminState.limit}`);
        
        if (adminState.filterStatus !== 'all') {
            queryParams.push(`status=${adminState.filterStatus}`);
        }
    }
    
    if (queryParams.length > 0) {
        endpoint += `?${queryParams.join('&')}`;
    }

    try {
        const data = await apiFetch(endpoint);
        
        // Extract array
        return data['complaints'] || data['pending_complaints'] || data;

    } catch (error) {
        console.error(`Failed to fetch ${fetchType} complaints:`, error);
        return [];
    }
}
 
let currentFeedbackComplaintId = null;

// Open modal
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Show feedback modal
async function showFeedbackModal(complaintId, role) {
    currentFeedbackComplaintId = complaintId;
    document.getElementById('modalComplaintId').textContent = complaintId;
    document.getElementById('feedbackComplaintId').value = complaintId;
    document.getElementById('feedbackList').innerHTML = '<p class="text-gray-500">Loading feedback...</p>';
    
    const feedbackContainer = document.getElementById('addFeedbackContainer');
    if (role === 'admin') {
        feedbackContainer.classList.add('hidden');
    } else {
        feedbackContainer.classList.remove('hidden');
    }

    openModal('feedbackModal');

    try {
        const responseData = await apiFetch(`/api/feedback/${complaintId}`);
        
        // Extract array
        const feedbackArray = responseData.success && Array.isArray(responseData.complaint)
                                ? responseData.complaint
                                : [];

        let html = '';
        if (feedbackArray.length === 0) {
            html = '<p class="text-gray-500">No feedback found yet.</p>';
        } else {
            html = feedbackArray.map(f => `
                <div class="border-b last:border-b-0 py-2">
                    <p class="font-semibold text-sm">Rating: ${f.rating} / 5.0</p>
                    <p class="text-gray-700 text-sm">${f.text}</p>
                    <p class="text-xs text-gray-400 mt-1">${new Date(f.created_at).toLocaleDateString()}</p>
                </div>
            `).join('');
        }
        document.getElementById('feedbackList').innerHTML = html;

    } catch (error) {
        document.getElementById('feedbackList').innerHTML = `<p class="text-red-500">Failed to load feedback: ${error.message}</p>`;
        console.error("Feedback fetch error:", error);
    }
}

// Add feedback
async function handleAddFeedback(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const complaintId = parseInt(form.feedbackComplaintId.value, 10);
    const text = form.feedbackText.value;
    const rating = parseFloat(form.feedbackRating.value);

    const feedbackPayload = {
        complaint_id: complaintId,
        text: text,
        rating: rating
    };

    try {
        await apiFetch('/api/feedback', {
            method: 'POST',
            body: JSON.stringify(feedbackPayload)
        });

        alert('Feedback added successfully!');
        form.reset();
        showFeedbackModal(complaintId, 'user');

    } catch (error) {
        alert(`Failed to add feedback: ${error.message}`);
        console.error("Feedback post error:", error);
    } finally {
        submitButton.disabled = false;
    }
}

// Handle status change
async function handleStatusChange(complaintId) {
    if (!window.confirm(`Acknowledge Complaint #${complaintId}?`)) return;

    try {
        await apiFetch(`/api/complaints/${complaintId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'acknowleged' }),
        });

        alert(`Complaint #${complaintId} acknowledged.`);
        // Reset state and re-render
        adminState.page = 1;
        adminState.allLoadedComplaints = [];
        renderView('admin');

    } catch (error) {
        alert(`Failed to change status: ${error.message}`);
        console.error("Status update error:", error);
    }
}

// Handle filter change
function handleFilterChange(newStatus) {
    if (adminState.filterStatus === newStatus) return;
    
    adminState.filterStatus = newStatus;
    adminState.page = 1;
    adminState.allLoadedComplaints = [];
    adminState.hasMore = true;
    
    renderView('admin');
}

// load next page
function handleLoadNextPage() {
    if (adminState.isLoading || !adminState.hasMore) return;
    adminState.page++;
    renderView('admin', true);
}

// Admin login
async function handleAdminLogin(event) {
    event.preventDefault();
    const key = document.getElementById('adminKey').value;
    if (key === ADMIN_SECRET_KEY) {
        // Reset admin state on login
        adminState.page = 1;
        adminState.filterStatus = 'pending';
        adminState.allLoadedComplaints = [];
        renderView('admin');
    } else {
        alert('Invalid Secret Key.');
    }
}

// Show admin gate
function showAdminGate(event) {
    event.preventDefault();
    renderView('admin-gate');
}

// Render user view
function renderUserView(complaints) {
    // Sort complaints
    const sortedComplaints = [...complaints].sort((a, b) => b.id - a.id);

    document.getElementById('app').innerHTML = `
        <h1 class="text-4xl font-extrabold text-blue-800 mb-2">Civic Complaint Submission</h1>
        
        <div class="bg-white p-6 rounded-xl shadow-lg mb-8">
            <h2 class="text-2xl font-semibold mb-4 text-gray-800">Submit a New Complaint</h2>
            <form id="complaintForm" class="space-y-4">
                
                <div>
                    <label for="title" class="block text-sm font-medium text-gray-700">Complaint Title</label>
                    <input type="text" id="title" name="title" class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Street light out" required>
                </div>

                <div>
                    <label for="description" class="block text-sm font-medium text-gray-700">Detailed Description</label>
                    <textarea id="description" name="description" rows="3" class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="Please describe the issue in detail." required></textarea>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label for="locationCoords" class="block text-sm font-medium text-gray-700">Location (Latitude, Longitude)</label>
                        <input type="text" id="locationCoords" name="locationCoords" class="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed" readonly required>
                        <p class="text-xs text-blue-600 mt-1">Automatically fetched via GPS. Coordinates will be set shortly.</p>
                    </div>
                    <div id="mapUser" class="rounded-lg shadow-inner"></div>
                </div>

                <div>
                    <label for="image" class="block text-sm font-medium text-gray-700">Attach Image (Optional)</label>
                    <input type="file" id="image" name="image" accept="image/*" class="mt-1 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                </div>

                <button type="submit" class="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition duration-150">
                    Submit Complaint
                </button>
            </form>
        </div>

        <div class="mb-8">
            <h2 class="text-2xl font-semibold mb-4 text-gray-800">Your Complaints (Showing ${sortedComplaints.length} Total, Newest First)</h2>
            <div id="recentComplaintsList" class="space-y-4">
                ${sortedComplaints.length > 0 ? sortedComplaints.map(c => `
                    <div class="complaint-card bg-white p-4 rounded-lg shadow flex flex-col space-y-2 border-l-4 border-gray-300">
                        <div class="flex justify-between items-start">
                            <p class="text-lg font-bold text-gray-900">${c.title}</p>
                            <span class="status-badge status-${c.status || 'pending'}">${(c.status || 'Pending').toUpperCase()}</span>
                        </div>
                        
                        <p class="text-sm text-gray-600">${c.description.substring(0, 80)}${c.description.length > 80 ? '...' : ''}</p>
                        
                        <div class="flex justify-between items-center text-xs text-gray-500 pt-1 border-t border-gray-100">
                            <div class="space-x-2">
                                <span class="font-medium">ID: ${c.id}</span>
                                <span class="font-medium">Category: ${c.category || 'N/A'}</span>
                            </div>
                            <div class="flex space-x-3 items-center">
                                ${c.image_url ? `<a href="${c.image_url}" target="_blank" class="text-blue-500 hover:underline font-medium">View Image</a>` : ''}
                                <button onclick="showFeedbackModal(${c.id}, 'user')" class="px-3 py-1 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition duration-150">
                                    Give Feedback
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('') : '<p class="text-gray-500">No complaints found for this device yet.</p>'}
            </div>
        </div>

        <p class="text-center text-sm text-gray-500">
            Are you municipal staff? 
            <a href="#" onclick="showAdminGate(event)" class="text-blue-600 hover:text-blue-800 font-medium">Admin Access Gate</a>
        </p>
    `;
    
    document.getElementById('complaintForm').addEventListener('submit', handleAddComplaint);
    initializeUserMap();
}

// Render admin view
function renderAdminView(complaints, append = false) {
    const appDiv = document.getElementById('app');
    
    if (!append) {
        // Initial render
        appDiv.innerHTML = `
            <h1 class="text-4xl font-extrabold text-indigo-800 mb-6">Municipal Administrator Dashboard</h1>
            <a href="#" onclick="renderView('user')" class="text-blue-600 hover:underline mb-6 inline-block text-sm font-medium">Switch to User View</a>
            
            <div class="bg-white p-6 rounded-xl shadow-lg mb-6">
                <h2 class="text-xl font-semibold mb-4 text-gray-800">Complaints Overview Map</h2>
                <div id="mapAdmin" class="rounded-lg shadow-inner mb-4"></div>
                <p class="text-xs text-gray-500">Showing all map markers for the complaints currently loaded in the table below. (Markers use priority color).</p>
            </div>

            <div class="flex space-x-3 mb-6">
                <button onclick="handleFilterChange('all')" id="filter-all" class="px-4 py-2 rounded-lg font-medium">
                    Show All
                </button>
                <button onclick="handleFilterChange('pending')" id="filter-pending" class="px-4 py-2 rounded-lg font-medium">
                    Pending
                </button>
                <button onclick="handleFilterChange('acknowleged')" id="filter-acknowleged" class="px-4 py-2 rounded-lg font-medium">
                    Acknowledged
                </button>
            </div>

            <div class="bg-white p-6 rounded-xl shadow-lg overflow-x-auto">
                <h2 class="text-2xl font-semibold mb-4 text-gray-800">Complaints List</h2>
                
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID / Category</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title & Description</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location (Lat, Long)</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="adminTableBody" class="bg-white divide-y divide-gray-200">
                        </tbody>
                </table>

                <div class="flex justify-center mt-6">
                    <button id="loadNextButton" onclick="handleLoadNextPage()" class="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition duration-150 font-medium disabled:opacity-50">
                        Load Next Page
                    </button>
                </div>
            </div>
        `;
    }

    const tableBody = document.getElementById('adminTableBody');
    const loadNextButton = document.getElementById('loadNextButton');
    const currentFilter = adminState.filterStatus;
    
    // Highlight active filter button
    const filterButtons = ['all', 'pending', 'acknowleged'];
    filterButtons.forEach(status => {
        const btn = document.getElementById(`filter-${status}`);
        if (btn) {
            if (status === currentFilter) {
                btn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
                btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
            } else {
                btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
                btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
            }
        }
    });

    // Set loading state
    adminState.isLoading = true;
    if (loadNextButton) loadNextButton.disabled = true;
    if (tableBody && !append) tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500"><div class="loader inline-block"></div> Loading...</td></tr>';

    fetchComplaints('admin').then(newComplaints => {
        
        adminState.isLoading = false;
        if (loadNextButton) loadNextButton.disabled = false;

        // Pagination check
        if (!newComplaints || newComplaints.length === 0) {
            adminState.hasMore = false;
            if (loadNextButton) {
                loadNextButton.textContent = 'No More Complaints';
                loadNextButton.disabled = true;
            }
        } else if (newComplaints.length < adminState.limit) {
            adminState.hasMore = false;
            if (loadNextButton) {
                loadNextButton.textContent = 'End of List';
                loadNextButton.disabled = true;
            }
        } else if (loadNextButton) {
             loadNextButton.textContent = `Load Next Page (Page ${adminState.page + 1})`;
        }
        
        // Priority sort new batch
        newComplaints.sort((a, b) => (b.priority || 1) - (a.priority || 1));

        if (!append) tableBody.innerHTML = '';
        
        // Update combined list for map
        adminState.allLoadedComplaints.push(...newComplaints);
        
        // Re-sort entire combined list by Priority
        adminState.allLoadedComplaints.sort((a, b) => (b.priority || 1) - (a.priority || 1));

        // Render table rows
        newComplaints.forEach(c => {
            const statusClass = `status-${c.status || 'pending'}`;
            const priorityInfo = getPriorityInfo(c.priority);
            
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';

            row.innerHTML = `
                <td class="px-4 py-4 whitespace-nowrap text-sm">
                    <div class="font-medium text-gray-900">#${c.id}</div>
                    <div class="text-xs text-gray-500 mt-1">Cat: ${c.category || 'N/A'}</div>
                </td>
                <td class="px-4 py-4 text-sm text-gray-700 max-w-xs overflow-hidden">
                    <p class="font-semibold">${c.title}</p>
                    <p class="text-xs text-gray-600 mt-1">${c.description.substring(0, 70)}${c.description.length > 70 ? '...' : ''}</p>
                    ${c.image_url ? `<a href="${c.image_url}" target="_blank" class="text-xs text-blue-500 hover:underline mt-1 inline-block font-medium">View Image</a>` : ''}
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm">
                        <span class="status-badge ${priorityInfo.className}">${priorityInfo.label} (${c.priority || 1})</span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    Lat: ${c.location_lat.toFixed(4)}, Long: ${c.location_long.toFixed(4)}
                </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                        <span class="status-badge ${statusClass}">${(c.status || 'pending').toUpperCase()}</span>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onclick="handleStatusChange(${c.id})" class="px-3 py-1 text-xs bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-50" ${c.status === 'acknowleged' ? 'disabled' : ''}>
                        Acknowledge
                    </button>
                    <button onclick="showFeedbackModal(${c.id}, 'admin')" class="px-3 py-1 text-xs bg-yellow-500 text-white rounded-full hover:bg-yellow-600">
                        View Feedback
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Initialize map
        initializeAdminMap(adminState.allLoadedComplaints);

    }).catch(e => {
        adminState.isLoading = false;
        if (loadNextButton) loadNextButton.disabled = true;
        console.error("Error during admin view rendering:", e);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Failed to load complaints: ${e.message}</td></tr>`;
    });

}

// Render admin gate
function renderAdminGateView() {
    document.getElementById('app').innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-screen-minus-padding">
            <div class="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
                <h1 class="text-3xl font-bold text-indigo-700 mb-6 text-center">Municipal Staff Access</h1>
                <p class="text-gray-600 mb-4 text-center">Enter the secret key to access the administrative dashboard.</p>
                
                <form id="adminLoginForm" class="space-y-4">
                    <div>
                        <label for="adminKey" class="sr-only">Secret Key</label>
                        <input type="password" id="adminKey" name="adminKey" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="Secret Key" required>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 transition duration-150">
                        Access Admin Dashboard
                    </button>
                </form>
                
                <p class="mt-6 text-center text-sm text-gray-500">
                    <a href="#" onclick="renderView('user')" class="text-blue-600 hover:text-blue-800 font-medium">Return to Complaint Submission</a>
                </p>
            </div>
        </div>
    `;
    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
}

// Global render view
async function renderView(viewName, append = false) {
    currentView = viewName;
    
    if (mapUser) mapUser.remove();
    if (mapAdmin) mapAdmin.remove();
    mapUser = null;
    mapAdmin = null;
    
    if (!append) {
        document.getElementById('app').innerHTML = `<div class="text-center py-20"><div class="loader inline-block h-8 w-8"></div><p class="mt-4 text-gray-600">Loading ${viewName} view...</p></div>`;
    }

    switch (viewName) {
        case 'admin':
            renderAdminView(adminState.allLoadedComplaints, append);
            break;
        case 'admin-gate':
            renderAdminGateView();
            break;
        case 'user':
        default:
            const userComplaints = await fetchComplaints('user', tempUserId);
            renderUserView(userComplaints);
            break;
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addFeedbackForm').addEventListener('submit', handleAddFeedback);
    renderView('user');
});