const IntentEngine = (() => {
    
    // Intent patterns معززة
    const INTENT_PATTERNS = {
        // === الأنشطة ===
        ACTIVITY_LICENSE: {
            keywords: ['ترخيص', 'تراخيص', 'رخصة', 'تصريح', 'موافقة', 'إجازة', 'تصريح تشغيل', 'سجل صناعي'],
            vectors: ['رخصة', 'ترخيص', 'تصريح'], // كلمات مميزة في vectors
            threshold: 0.70,
            dataType: 'activities'
        },
        ACTIVITY_AUTHORITY: {
            keywords: ['جهة', 'جهات', 'هيئة', 'وزارة', 'مصلحة', 'مختص', 'مسؤول', 'إصدار', 'إدارة'],
            vectors: ['جهة', 'هيئة', 'وزارة'],
            threshold: 0.70,
            dataType: 'activities'
        },
        ACTIVITY_LAW: {
            keywords: ['قانون', 'قوانين', 'تشريع', 'لائحة', 'سند تشريعي', 'سند قانوني', 'مادة', 'بند'],
            vectors: ['قانون', 'تشريع', 'لائحة'],
            threshold: 0.75,
            dataType: 'activities'
        },
        
        // === المناطق الصناعية ===
        INDUSTRIAL_ZONE_SEARCH: {
            keywords: ['منطقة صناعية', 'مناطق صناعية', 'صناعية', 'منطقة', 'مدينة صناعية'],
            vectors: ['منطقة صناعية', 'صناعية', 'مدينة صناعية'],
            threshold: 0.80,
            dataType: 'industrial'
        },
        INDUSTRIAL_ZONE_DETAILS: {
            keywords: ['تفاصيل', 'معلومات', 'بيانات', 'مواصفات', 'خصائص', 'صفات'],
            vectors: ['تفاصيل', 'معلومات', 'بيانات'],
            threshold: 0.70,
            dataType: 'industrial'
        },
        
        // === القرار 104 ===
        DECISION104_CHECK: {
            keywords: ['قرار 104', 'القرار 104', 'حافز', 'حوافز', 'إعفاء', 'إعفاءات', 'مشمول', 'يشمل'],
            vectors: ['قرار 104', 'حافز', 'إعفاء'],
            threshold: 0.85,
            dataType: 'decision104'
        },
        DECISION104_DETAILS: {
            keywords: ['تفاصيل القرار', 'بنود القرار', 'مواد القرار', 'نص القرار'],
            vectors: ['تفاصيل', 'بنود', 'مواد'],
            threshold: 0.75,
            dataType: 'decision104'
        }
    };

    // ================ تحليل النية باستخدام Vectors ================
    async function parseIntentWithVectors(query, history = []) {
        const normalized = normalizeArabic(query);
        const queryTokens = normalized.split(/\s+/).filter(t => t.length > 2);
        
        // تحميل جميع البيانات للتحليل
        const allData = DataLoader.getAllData();
        const intents = [];
        
        // تحليل كل نوع نية
        for (const [intentName, pattern] of Object.entries(INTENT_PATTERNS)) {
            let score = 0;
            let matchedVectors = [];
            
            // 1. مطابقة الكلمات المفتاحية التقليدية (40%)
            const keywordScore = calculateKeywordScore(normalized, pattern.keywords);
            score += keywordScore * 0.4;
            
            // 2. مطابقة مع Vectors الأنشطة (30%)
            if (allData.activities && pattern.dataType === 'activities') {
                const vectorScore = await calculateVectorSimilarity(query, allData.activities, pattern.vectors);
                score += vectorScore * 0.3;
            }
            
            // 3. مطابقة مع Vectors القرار 104 (30%)
            if (allData.decision104 && pattern.dataType === 'decision104') {
                const vectorScore = await calculateVectorSimilarity(query, allData.decision104, pattern.vectors);
                score += vectorScore * 0.3;
            }
            
            // 4. مكافأة للتكرار في التاريخ (للمتابعة)
            if (isFollowUpQuery(query, history, intentName)) {
                score += 0.2;
            }
            
            if (score >= pattern.threshold) {
                intents.push({
                    name: intentName,
                    confidence: score,
                    dataType: pattern.dataType,
                    matchedVectors,
                    isFollowUp: isFollowUpQuery(query, history, intentName)
                });
            }
        }
        
        // تحديد النية الأساسية
        intents.sort((a, b) => b.confidence - a.confidence);
        const primaryIntent = intents[0] || { 
            name: 'GENERAL', 
            confidence: 0.5,
            dataType: 'all'
        };
        
        // استخراج الكيانات
        const entities = extractEntitiesFromVectors(query, allData);
        
        return {
            primary: primaryIntent,
            all: intents,
            entities,
            queryTokens,
            context: buildVectorContext(history, allData)
        };
    }
    
    // ================ حساب تشابه Vectors ================
    async function calculateVectorSimilarity(query, vectors, targetVectors = []) {
        if (!vectors || vectors.length === 0) return 0;
        
        const queryNorm = normalizeArabic(query);
        let totalScore = 0;
        let matchCount = 0;
        
        // البحث في النصوص المعززة (enriched_text) أولاً
        vectors.forEach(item => {
            if (item.enriched_text) {
                const enrichedNorm = normalizeArabic(item.enriched_text);
                
                // مطابقة مع target vectors
                targetVectors.forEach(target => {
                    if (enrichedNorm.includes(normalizeArabic(target))) {
                        totalScore += 1.0;
                        matchCount++;
                    }
                });
                
                // مطابقة مع query
                const queryWords = queryNorm.split(/\s+/);
                queryWords.forEach(word => {
                    if (word.length > 2 && enrichedNorm.includes(word)) {
                        totalScore += 0.5;
                        matchCount++;
                    }
                });
            }
        });
        
        return matchCount > 0 ? totalScore / matchCount : 0;
    }
    
    // ================ استخراج الكيانات من Vectors ================
    function extractEntitiesFromVectors(query, allData) {
        const entities = {
            activities: [],
            zones: [],
            decisions: [],
            keywords: []
        };
        
        const queryNorm = normalizeArabic(query);
        
        // استخراج الأنشطة
        if (allData.activities) {
            allData.activities.forEach(activity => {
                const activityNorm = normalizeArabic(activity.text);
                // إذا كان النشاط مذكور في الاستعلام
                if (queryNorm.includes(activityNorm) || activityNorm.includes(queryNorm)) {
                    entities.activities.push({
                        name: activity.text,
                        id: activity.id,
                        matchScore: calculateTextSimilarity(queryNorm, activityNorm)
                    });
                }
            });
        }
        
        // استخراج المناطق الصناعية
        if (allData.industrial) {
            allData.industrial.forEach(zone => {
                const zoneNorm = normalizeArabic(zone.text);
                if (queryNorm.includes(zoneNorm) || zoneNorm.includes(queryNorm)) {
                    entities.zones.push({
                        name: zone.text,
                        id: zone.id,
                        matchScore: calculateTextSimilarity(queryNorm, zoneNorm)
                    });
                }
            });
        }
        
        // ترتيب الكيانات حسب درجة المطابقة
        entities.activities.sort((a, b) => b.matchScore - a.matchScore);
        entities.zones.sort((a, b) => b.matchScore - a.matchScore);
        
        return entities;
    }
    
    // ================ بناء السياق من Vectors ================
    function buildVectorContext(history, allData) {
        if (history.length === 0) return null;
        
        const context = {
            recentEntities: {},
            topicFlow: [],
            vectorReferences: []
        };
        
        // تحليل آخر 3 أسئلة
        const recentHistory = history.slice(-3);
        
        recentHistory.forEach((item, index) => {
            // جمع الكيانات من الأسئلة السابقة
            if (item.entities) {
                Object.keys(item.entities).forEach(entityType => {
                    if (!context.recentEntities[entityType]) {
                        context.recentEntities[entityType] = [];
                    }
                    context.recentEntities[entityType].push(...item.entities[entityType]);
                });
            }
            
            // تتبع تدفق الموضوعات
            if (item.intent) {
                context.topicFlow.push({
                    intent: item.intent.primary.name,
                    query: item.question,
                    timestamp: item.timestamp
                });
            }
        });
        
        // إزالة التكرارات
        Object.keys(context.recentEntities).forEach(key => {
            context.recentEntities[key] = [...new Set(context.recentEntities[key])];
        });
        
        return context;
    }
    
    // ================ دعم الإكمال التلقائي والتوقع ================
    function predictNextQuestion(currentIntent, context) {
        const predictions = [];
        
        if (currentIntent.name.startsWith('ACTIVITY')) {
            predictions.push(
                "ما هي التراخيص المطلوبة؟",
                "ما هي الجهات المختصة؟",
                "هل يحتاج إلى موافقات خاصة؟"
            );
        } else if (currentIntent.name.startsWith('INDUSTRIAL')) {
            predictions.push(
                "ما هي مساحتها؟",
                "ما هي التبعية الإدارية؟",
                "هل توجد أراضي متاحة؟"
            );
        } else if (currentIntent.name.startsWith('DECISION104')) {
            predictions.push(
                "ما هي الحوافز المتاحة؟",
                "هل هناك إعفاءات جمركية؟",
                "ما هي الإجراءات المطلوبة؟"
            );
        }
        
        return predictions;
    }
    
    // ================ الدوال المساعدة ================
    function calculateKeywordScore(query, keywords) {
        const normalized = normalizeArabic(query);
        let matches = 0;
        
        keywords.forEach(keyword => {
            if (normalized.includes(normalizeArabic(keyword))) {
                matches++;
            }
        });
        
        return keywords.length > 0 ? matches / keywords.length : 0;
    }
    
    function calculateTextSimilarity(text1, text2) {
        const words1 = text1.split(/\s+/);
        const words2 = text2.split(/\s+/);
        
        const intersection = words1.filter(word => 
            words2.some(w => w.includes(word) || word.includes(w))
        );
        
        const union = [...new Set([...words1, ...words2])];
        
        return union.length > 0 ? intersection.length / union.length : 0;
    }
    
    function isFollowUpQuery(query, history, intentName) {
        if (history.length === 0) return false;
        
        const lastIntent = history[history.length - 1].intent;
        if (!lastIntent) return false;
        
        // إذا كان السؤال يشير إلى شيء سابق
        const followUpWords = ['هذا', 'هذه', 'تلك', 'السابق', 'المذكور', 'نفس'];
        const hasFollowUpIndicator = followUpWords.some(word => 
            normalizeArabic(query).includes(normalizeArabic(word))
        );
        
        return hasFollowUpIndicator && lastIntent.primary.name === intentName;
    }
    
    function normalizeArabic(text) {
        if (!text) return '';
        return text
            .replace(/[ًٌٍَُِّْ]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    return {
        normalizeArabic,
        parseIntentWithVectors,
        extractEntitiesFromVectors,
        buildVectorContext,
        predictNextQuestion,
        calculateVectorSimilarity
    };
})();
