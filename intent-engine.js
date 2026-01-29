/**
 * Intent Engine - محرك فهم النية
 * يحلل الأسئلة ويستخرج الكيانات ويفهم السياق
 */

const IntentEngine = (() => {
    
    // Intent patterns
    const INTENT_PATTERNS = {
        ACTIVITY_LICENSE: {
            keywords: ['ترخيص', 'تراخيص', 'رخصة', 'تصريح', 'موافقة', 'سجل صناعي', 'رخصة تشغيل'],
            entities: ['نشاط', 'مصنع', 'شركة', 'مشروع'],
            threshold: 0.65
        },
        ACTIVITY_AUTHORITY: {
            keywords: ['جهة', 'جهات', 'هيئة', 'وزارة', 'مصلحة', 'إصدار', 'مختص', 'المسؤول'],
            entities: ['نشاط'],
            threshold: 0.65
        },
        ACTIVITY_LAW: {
            keywords: ['قانون', 'قوانين', 'تشريع', 'لائحة', 'قرار', 'سند تشريعي', 'سند قانوني'],
            entities: ['نشاط'],
            threshold: 0.70
        },
        ACTIVITY_GUIDE: {
            keywords: ['دليل', 'أدلة', 'إرشادات', 'خطوات', 'إجراءات'],
            entities: ['نشاط'],
            threshold: 0.65
        },
        ACTIVITY_LOCATION: {
            keywords: ['موقع', 'مكان', 'منطقة', 'أين', 'مواقع', 'أماكن'],
            entities: ['نشاط', 'ممارسة'],
            threshold: 0.65
        },
        ACTIVITY_TECHNICAL: {
            keywords: ['فني', 'معاينة', 'نقاط فنية', 'اشتراطات', 'متطلبات فنية', 'فحص'],
            entities: ['نشاط', 'شركة', 'مصنع'],
            threshold: 0.65
        },
        ACTIVITY_DESCRIPTION: {
            keywords: ['توصيف', 'وصف', 'ما هو', 'تعريف', 'شرح'],
            entities: ['نشاط'],
            threshold: 0.65
        },
        INDUSTRIAL_ZONE: {
            keywords: ['منطقة صناعية', 'مناطق صناعية', 'صناعية', 'منطقة'],
            entities: ['محافظة', 'موقع', 'مكان'],
            threshold: 0.70
        },
        INDUSTRIAL_ZONE_AUTHORITY: {
            keywords: ['تبعية', 'جهة الولاية', 'ولاية', 'مسؤول', 'إدارة'],
            entities: ['منطقة'],
            threshold: 0.70
        },
        INDUSTRIAL_ZONE_DECISION: {
            keywords: ['قرار', 'قرار إنشاء', 'إنشاء', 'تأسيس'],
            entities: ['منطقة'],
            threshold: 0.70
        },
        INDUSTRIAL_ZONE_AREA: {
            keywords: ['مساحة', 'حجم', 'كم فدان', 'المساحة'],
            entities: ['منطقة'],
            threshold: 0.70
        },
        INDUSTRIAL_ZONE_CHECK: {
            keywords: ['هل', 'منطقة صناعية', 'معتمد', 'معتمدة'],
            entities: ['موقع', 'مكان', 'عنوان'],
            threshold: 0.75
        },
        DECISION104: {
            keywords: ['قرار 104', 'القرار 104', 'حافز', 'حوافز', 'قرار', 'إعفاء'],
            entities: ['نشاط'],
            threshold: 0.70
        },
        DECISION104_SECTOR: {
            keywords: ['قطاع', 'قطاع أ', 'قطاع ب', 'أي قطاع'],
            entities: ['نشاط', 'قرار 104'],
            threshold: 0.70
        }
    };

    // Entity patterns
    const ENTITY_PATTERNS = {
        ACTIVITY_NAME: /(?:نشاط|أنشطة)\s+(\w+(?:\s+\w+){0,3})/g,
        GOVERNORATE: /(?:محافظة|بمحافظة|في)\s+(\w+)/g,
        ZONE_NAME: /(?:منطقة|بمنطقة)\s+([^،\n]+)/g,
        DECISION_NUMBER: /(?:قرار|القرار)\s+(\d+)/g,
        SECTOR: /قطاع\s+([أب])/g
    };

    /**
     * Normalize Arabic text
     */
    function normalizeArabic(text) {
        if (!text) return '';
        
        return text
            .replace(/[ًٌٍَُِّْ]/g, '') // Remove tashkeel
            .replace(/[أإآ]/g, 'ا')     // Normalize alef
            .replace(/ى/g, 'ي')         // Normalize ya
            .replace(/\s+/g, ' ')       // Normalize spaces
            .trim();
    }

    /**
     * Extract entities from text
     */
    function extractEntities(text) {
        const normalized = normalizeArabic(text);
        const entities = {};

        // Extract activity names
        const activityMatches = [...normalized.matchAll(ENTITY_PATTERNS.ACTIVITY_NAME)];
        if (activityMatches.length > 0) {
            entities.activities = activityMatches.map(m => m[1].trim());
        }

        // Extract governorates
        const govMatches = [...normalized.matchAll(ENTITY_PATTERNS.GOVERNORATE)];
        if (govMatches.length > 0) {
            entities.governorates = govMatches.map(m => m[1].trim());
        }

        // Extract zone names
        const zoneMatches = [...normalized.matchAll(ENTITY_PATTERNS.ZONE_NAME)];
        if (zoneMatches.length > 0) {
            entities.zones = zoneMatches.map(m => m[1].trim());
        }

        // Extract decision numbers
        const decisionMatches = [...normalized.matchAll(ENTITY_PATTERNS.DECISION_NUMBER)];
        if (decisionMatches.length > 0) {
            entities.decisions = decisionMatches.map(m => m[1]);
        }

        // Extract sectors
        const sectorMatches = [...normalized.matchAll(ENTITY_PATTERNS.SECTOR)];
        if (sectorMatches.length > 0) {
            entities.sectors = sectorMatches.map(m => m[1]);
        }

        return entities;
    }

    /**
     * Parse intent from query
     */
    function parseIntent(query, history = []) {
        const normalized = normalizeArabic(query);
        const entities = extractEntities(query);
        const intents = [];

        // Check each intent pattern
        for (const [intentName, pattern] of Object.entries(INTENT_PATTERNS)) {
            let score = 0;
            let matchedKeywords = [];

            // Check keywords
            for (const keyword of pattern.keywords) {
                if (normalized.includes(normalizeArabic(keyword))) {
                    score += 1;
                    matchedKeywords.push(keyword);
                }
            }

            // Check entities
            for (const entity of pattern.entities) {
                if (normalized.includes(normalizeArabic(entity))) {
                    score += 0.5;
                }
            }

            // Calculate confidence
            const maxScore = pattern.keywords.length + pattern.entities.length * 0.5;
            const confidence = maxScore > 0 ? score / maxScore : 0;

            if (confidence >= pattern.threshold) {
                intents.push({
                    name: intentName,
                    confidence,
                    matchedKeywords,
                    threshold: pattern.threshold
                });
            }
        }

        // Sort by confidence
        intents.sort((a, b) => b.confidence - a.confidence);

        // Handle follow-up questions
        const isFollowUp = detectFollowUp(query, history);
        if (isFollowUp && history.length > 0) {
            const lastIntent = history[history.length - 1].intent;
            if (lastIntent && intents.length === 0) {
                // Inherit previous intent with lower confidence
                intents.push({
                    name: lastIntent.name,
                    confidence: 0.6,
                    matchedKeywords: [],
                    isInherited: true
                });
            }
        }

        return {
            primary: intents[0] || { name: 'GENERAL', confidence: 0.5 },
            all: intents,
            entities,
            isFollowUp,
            normalized
        };
    }

    /**
     * Detect follow-up questions
     */
    function detectFollowUp(query, history) {
        if (history.length === 0) return false;

        const normalized = normalizeArabic(query);
        const followUpIndicators = [
            'هذا',
            'هذه',
            'تلك',
            'ذلك',
            'السابق',
            'المذكور',
            'نفس',
            'أيضا',
            'كذلك',
            'وماذا عن',
            'ماذا عن'
        ];

        return followUpIndicators.some(indicator => 
            normalized.includes(normalizeArabic(indicator))
        );
    }

    /**
     * Build context from history
     */
    function buildContext(history) {
        if (history.length === 0) return null;

        const recentHistory = history.slice(-3); // Last 3 exchanges
        const context = {
            entities: {},
            topics: [],
            keywords: []
        };

        recentHistory.forEach(item => {
            // Merge entities
            if (item.entities) {
                Object.keys(item.entities).forEach(key => {
                    if (!context.entities[key]) {
                        context.entities[key] = [];
                    }
                    context.entities[key].push(...item.entities[key]);
                });
            }

            // Collect topics
            if (item.intent && item.intent.primary) {
                context.topics.push(item.intent.primary.name);
            }
        });

        // Deduplicate
        Object.keys(context.entities).forEach(key => {
            context.entities[key] = [...new Set(context.entities[key])];
        });
        context.topics = [...new Set(context.topics)];

        return context;
    }

    /**
     * Decompose complex query
     */
    function decomposeQuery(query) {
        const normalized = normalizeArabic(query);
        const subQueries = [];

        // Split by conjunctions
        const parts = normalized.split(/\s+(?:و|أو|ثم|كذلك)\s+/);
        
        if (parts.length > 1) {
            parts.forEach((part, idx) => {
                if (part.trim().length > 10) { // Meaningful length
                    subQueries.push({
                        text: part.trim(),
                        order: idx,
                        isSubQuery: true
                    });
                }
            });
        }

        return subQueries.length > 1 ? subQueries : null;
    }

    /**
     * Get dynamic threshold based on intent
     */
    function getDynamicThreshold(intent) {
        const thresholds = {
            ACTIVITY_LICENSE: 0.60,
            ACTIVITY_AUTHORITY: 0.60,
            ACTIVITY_LAW: 0.65,
            ACTIVITY_GUIDE: 0.60,
            ACTIVITY_LOCATION: 0.60,
            ACTIVITY_TECHNICAL: 0.65,
            ACTIVITY_DESCRIPTION: 0.60,
            INDUSTRIAL_ZONE: 0.70,
            INDUSTRIAL_ZONE_AUTHORITY: 0.70,
            INDUSTRIAL_ZONE_DECISION: 0.70,
            INDUSTRIAL_ZONE_AREA: 0.70,
            INDUSTRIAL_ZONE_CHECK: 0.75,
            DECISION104: 0.65,
            DECISION104_SECTOR: 0.70,
            GENERAL: 0.55
        };

        return thresholds[intent] || 0.60;
    }

    return {
        normalizeArabic,
        extractEntities,
        parseIntent,
        detectFollowUp,
        buildContext,
        decomposeQuery,
        getDynamicThreshold
    };
})();