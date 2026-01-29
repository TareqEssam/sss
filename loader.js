/**
 * Data Loader - محمل البيانات الذكي
 * يقوم بتحميل vectors مرة واحدة وتخزينها في IndexedDB
 */

const DataLoader = (() => {
    const DB_NAME = 'ExpertAssistantDB';
    const DB_VERSION = 1;
    const STORES = {
        ACTIVITIES: 'activities',
        DECISION104: 'decision104',
        INDUSTRIAL: 'industrial',
        META: 'metadata'
    };

    let db = null;
    let vectorData = {
        activities: null,
        decision104: null,
        industrial: null
    };

    /**
     * Initialize database
     */
    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains(STORES.ACTIVITIES)) {
                    db.createObjectStore(STORES.ACTIVITIES, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.DECISION104)) {
                    db.createObjectStore(STORES.DECISION104, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.INDUSTRIAL)) {
                    db.createObjectStore(STORES.INDUSTRIAL, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.META)) {
                    db.createObjectStore(STORES.META, { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Check if cache is valid
     */
    async function isCacheValid() {
        if (!db) return false;

        return new Promise((resolve) => {
            const tx = db.transaction([STORES.META], 'readonly');
            const store = tx.objectStore(STORES.META);
            const request = store.get('version');

            request.onsuccess = () => {
                const meta = request.result;
                if (!meta) {
                    resolve(false);
                    return;
                }

                // Check version and expiry (30 days)
                const isValid = meta.value === DB_VERSION && 
                               (Date.now() - meta.timestamp) < 30 * 24 * 60 * 60 * 1000;
                resolve(isValid);
            };

            request.onerror = () => resolve(false);
        });
    }

    /**
     * Load vectors from file
     */
    async function loadVectorFile(filename) {
        const response = await fetch(`data/${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        
        const text = await response.text();
        
        // Extract variable name and parse
        const match = text.match(/const\s+(\w+)\s*=\s*({[\s\S]+});?\s*$/);
        if (!match) {
            throw new Error(`Invalid format in ${filename}`);
        }

        return JSON.parse(match[2]);
    }

    /**
     * Save to IndexedDB
     */
    async function saveToCache(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);

            // Clear existing data
            store.clear();

            // Add all vectors
            data.vectors.forEach(vector => {
                store.add(vector);
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Load from IndexedDB
     */
    async function loadFromCache(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update metadata
     */
    async function updateMetadata() {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.META], 'readwrite');
            const store = tx.objectStore(STORES.META);

            store.put({
                key: 'version',
                value: DB_VERSION,
                timestamp: Date.now()
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Main initialization function
     */
    async function initialize() {
        // Open database
        await initDB();

        // Check if we have valid cache
        const cacheValid = await isCacheValid();

        if (cacheValid) {
            // Load from cache
            console.log('📦 Loading from cache...');
            vectorData.activities = await loadFromCache(STORES.ACTIVITIES);
            vectorData.decision104 = await loadFromCache(STORES.DECISION104);
            vectorData.industrial = await loadFromCache(STORES.INDUSTRIAL);
            console.log('✅ Loaded from cache');
        } else {
            // Load from files and cache
            console.log('🌐 Loading from files (first time)...');
            
            const [activitiesData, decision104Data, industrialData] = await Promise.all([
                loadVectorFile('activity_vectors.js'),
                loadVectorFile('decision104_vectors.js'),
                loadVectorFile('industrial_vectors.js')
            ]);

            // Save to cache
            await Promise.all([
                saveToCache(STORES.ACTIVITIES, activitiesData),
                saveToCache(STORES.DECISION104, decision104Data),
                saveToCache(STORES.INDUSTRIAL, industrialData)
            ]);

            // Update metadata
            await updateMetadata();

            // Load into memory
            vectorData.activities = activitiesData.vectors;
            vectorData.decision104 = decision104Data.vectors;
            vectorData.industrial = industrialData.vectors;

            console.log('✅ Loaded and cached');
        }

        // Build indices for fast search
        buildIndices();
    }

    /**
     * Build search indices
     */
    function buildIndices() {
        // Normalize vectors for faster cosine similarity
        [vectorData.activities, vectorData.decision104, vectorData.industrial].forEach(dataset => {
            dataset?.forEach(item => {
                if (item.vector) {
                    const magnitude = Math.sqrt(item.vector.reduce((sum, val) => sum + val * val, 0));
                    item.normalizedVector = item.vector.map(v => v / magnitude);
                }
            });
        });
    }

    /**
     * Get all data
     */
    function getAllData() {
        return vectorData;
    }

    /**
     * Get data by type
     */
    function getDataByType(type) {
        return vectorData[type] || [];
    }

    /**
     * Get total vectors count
     */
    function getTotalVectors() {
        return (vectorData.activities?.length || 0) +
               (vectorData.decision104?.length || 0) +
               (vectorData.industrial?.length || 0);
    }

    /**
     * Clear cache (for debugging)
     */
    async function clearCache() {
        if (!db) return;

        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORES.ACTIVITIES, STORES.DECISION104, STORES.INDUSTRIAL, STORES.META], 'readwrite');
            
            tx.objectStore(STORES.ACTIVITIES).clear();
            tx.objectStore(STORES.DECISION104).clear();
            tx.objectStore(STORES.INDUSTRIAL).clear();
            tx.objectStore(STORES.META).clear();

            tx.oncomplete = () => {
                console.log('🗑️ Cache cleared');
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    return {
        initialize,
        getAllData,
        getDataByType,
        getTotalVectors,
        clearCache
    };
})();