/**
 * Intent Engine v2 - محرك فهم النية المتقدم
 * فهم عميق للسياق والعلاقات والأسئلة المعقدة
 */

const IntentEngine = (() => {
    
    // أنماط النوايا المحسّنة
    const INTENT_PATTERNS = {
        ACTIVITY_LICENSE: {
            keywords: ['ترخيص', 'تراخيص', 'رخصة', 'تصريح', 'موافقة', 'سجل صناعي', 'رخصة تشغيل', 'إجراءات', 'خطوات'],
            negativeKeywords: ['جهة', 'قانون', 'دليل', 'منطقة'],
            patterns: [/ما\s+(?:هي|هو)\s+(?:التراخيص|الرخص|المتطلبات)/i],
            weight: 1.0,
            threshold: 0.60
        },
        ACTIVITY_AUTHORITY: {
            keywords: ['جهة', 'جهات', 'هيئة', 'وزارة', 'مصلحة', 'إصدار', 'مختص', 'المسؤول', 'المختصة'],
            negativeKeywords: ['ترخيص', 'قانون'],
            patterns: [/من\s+(?:الجهة|المسؤول|المختص)/i, /أي\s+جهة/i],
            weight: 1.0,
            threshold: 0.60
        },
        ACTIVITY_LAW: {
            keywords: ['قانون', 'قوانين', 'تشريع', 'لائحة', 'قرار', 'سند تشريعي', 'سند قانوني', 'التشريع'],
            negativeKeywords: ['دليل', 'إجراءات'],
            patterns: [/ما\s+(?:هو|القانون|التشريع)/i],
            weight: 1.0,
            threshold: 0.65
        },
        ACTIVITY_GUIDE: {
            keywords: ['دليل', 'أدلة', 'إرشادات', 'خطوات', 'كيف', 'طريقة'],
            negativeKeywords: ['قانون', 'جهة'],
            patterns: [/كيف\s+(?:أحصل|نحصل|يمكن)/i],
            weight: 1.0,
            threshold: 0.60
        },
        ACTIVITY_LOCATION: {
            keywords: ['موقع', 'مكان', 'منطقة', 'أين', 'مواقع', 'أماكن', 'ممارسة النشاط', 'مزاولة'],
            negativeKeywords: ['قرار', 'إنشاء'],
            patterns: [/أين\s+(?:يمكن|أستطيع|نستطيع)/i, /في\s+أي\s+(?:مكان|منطقة)/i],
            weight: 1.0,
            threshold: 0.60
        },
        ACTIVITY_TECHNICAL: {
            keywords: ['فني', 'معاينة', 'نقاط فنية', 'اشتراطات', 'متطلبات فنية', 'فحص', 'تقنية', 'اشتراطات فنية'],
            negativeKeywords: [],
            patterns: [/(?:النقاط|الاشتراطات)\s+الفنية/i],
            weight: 1.0,
            threshold: 0.60
        },
        ACTIVITY_DESCRIPTION: {
            keywords: ['توصيف', 'وصف', 'ما هو', 'تعريف', 'شرح', 'معنى'],
            negativeKeywords: ['ترخيص', 'جهة', 'قانون'],
            patterns: [/ما\s+(?:هو|معنى|تعريف)/i],
            weight: 1.0,
            threshold: 0.60
        },
        INDUSTRIAL_ZONE: {
            keywords: ['منطقة صناعية', 'مناطق صناعية', 'صناعية', 'المناطق الصناعية'],
            negativeKeywords: [],
            patterns: [/(?:المناطق|مناطق)\s+(?:الصناعية|صناعية)/i],
            weight: 1.2,
            threshold: 0.65
        },
        INDUSTRIAL_ZONE_AUTHORITY: {
            keywords: ['تبعية', 'جهة الولاية', 'ولاية', 'مسؤول عن المنطقة', 'إدارة المنطقة'],
            negativeKeywords: [],
            patterns: [/(?:تبعية|جهة)\s+(?:المنطقة|الولاية)/i],
            weight: 1.0,
            threshold: 0.65
        },
        INDUSTRIAL_ZONE_DECISION: {
            keywords: ['قرار إنشاء', 'قرار', 'إنشاء المنطقة', 'تأسيس'],
            negativeKeywords: [],
            patterns: [/قرار\s+(?:إنشاء|تأسيس)/i],
            weight: 1.0,
            threshold: 0.65
        },
        INDUSTRIAL_ZONE_AREA: {
            keywords: ['مساحة', 'حجم', 'كم فدان', 'المساحة', 'حجم المنطقة'],
            negativeKeywords: [],
            patterns: [/(?:مساحة|حجم)\s+(?:المنطقة)?/i],
            weight: 1.0,
            threshold: 0.65
        },
        INDUSTRIAL_ZONE_CHECK: {
            keywords: ['هل', 'معتمد', 'معتمدة', 'منطقة صناعية؟'],
            negativeKeywords: [],
            patterns: [/هل\s+.*\s+منطقة\s+صناعية/i],
            weight: 1.0,
            threshold: 0.70
        },
        DECISION104: {
            keywords: ['قرار 104', 'القرار 104', 'حافز', 'حوافز', 'إعفاء', 'في القرار'],
            negativeKeywords: [],
            patterns: [/(?:القرار|قرار)\s*104/i, /في\s+القرار/i],
            weight: 1.2,
            threshold: 0.65
        },
        DECISION104_SECTOR: {
            keywords: ['قطاع', 'قطاع أ', 'قطاع ب', 'أي قطاع', 'القطاعات'],
            negativeKeywords: [],
            patterns: [/قطاع\s*[أب]/i],
            weight: 1.0,
            threshold: 0.65
        }
    };

    // أنماط الكيانات المحسّنة
    const ENTITY_PATTERNS = {
        ACTIVITY_NAME: [
            /نشاط\s+([^\n،؛.]{3,50})/g,
            /(?:مصنع|مشروع|شركة)\s+([^\n،؛.]{3,50})/g,
            /(?:تصنيع|إنتاج|صناعة)\s+([^\n،؛.]{3,50})/g
        ],
        GOVERNORATE: [
            /(?:محافظة|بمحافظة|في)\s+(\w+)/g,
            /(?:بالقاهرة|بالجيزة|بالإسكندرية|بأسوان|بالأقصر)/g
        ],
        ZONE_NAME: [
            /(?:منطقة|بمنطقة)\s+([^،\n]{3,50})/g,
            /(?:العاشر من رمضان|السادس من أكتوبر|برج العرب|الصف|بدر)/gi
        ],
        DECISION_NUMBER: [
            /(?:قرار|القرار)\s+(\d+)/g,
            /(?:رقم)\s+(\d+)/g
        ],
        SECTOR: [
            /قطاع\s+([أب])/g
        ]
    };

    // كلمات التوقف
    const STOP_WORDS = new Set([
        'في', 'من', 'الى', 'إلى', 'على', 'عن', 'هل', 'ما', 'هو', 'هي',
        'لا', 'نعم', 'كان', 'يكون', 'ان', 'أن', 'إن', 'التي', 'الذي', 
        'هذا', 'هذه', 'ذلك', 'تلك', 'او', 'أو', 'لكن', 'ثم', 'قد', 'كل',
        'بعض', 'اي', 'أي', 'اين', 'أين', 'متى', 'كيف', 'لماذا', 'عند',
        'مع', 'ضد', 'بين', 'حول', 'خلال', 'قبل', 'بعد', 'فوق', 'تحت',
        'امام', 'أمام', 'خلف', 'داخل', 'خارج', 'حتى', 'الي', 'إلي'
    ]);

    /**
     * تطبيع النص العربي
     */
    function normalizeArabic(text) {
        if (!text) return '';
        
        return text
            .replace(/[ًٌٍَُِّْ]/g, '')           // إزالة التشكيل
            .replace(/[أإآ]/g, 'ا')               // توحيد الألف
            .replace(/ى/g, 'ي')                   // توحيد الياء
            .replace(/ة/g, 'ه')                   // توحيد التاء المربوطة
            .replace(/[ؤئ]/g, 'ء')               // توحيد الهمزة
            .replace(/\s+/g, ' ')                 // توحيد المسافات
            .trim();
    }

    /**
     * استخراج الكيانات المتقدم
     */
    function extractEntities(text) {
        const normalized = normalizeArabic(text);
        const entities = {};

        // استخراج أسماء الأنشطة
        const activities = new Set();
        ENTITY_PATTERNS.ACTIVITY_NAME.forEach(pattern => {
            const matches = [...normalized.matchAll(pattern)];
            matches.forEach(m => {
                if (m[1] && m[1].length >= 3) {
                    activities.add(m[1].trim());
                }
            });
        });
        if (activities.size > 0) {
            entities.activities = Array.from(activities);
        }

        // استخراج المحافظات
        const governorates = new Set();
        ENTITY_PATTERNS.GOVERNORATE.forEach(pattern => {
            const matches = [...normalized.matchAll(pattern)];
            matches.forEach(m => {
                const gov = m[1] || m[0].replace(/(?:بالقاهرة|بالجيزة|بالإسكندرية|بأسوان|بالأقصر|في|ب)/g, '').trim();
                if (gov && gov.length >= 3) {
                    governorates.add(gov);
                }
            });
        });
        if (governorates.size > 0) {
            entities.governorates = Array.from(governorates);
        }

        // استخراج أسماء المناطق
        const zones = new Set();
        ENTITY_PATTERNS.ZONE_NAME.forEach(pattern => {
            const matches = [...normalized.matchAll(pattern)];
            matches.forEach(m => {
                const zone = m[1] || m[0];
                if (zone && zone.length >= 3) {
                    zones.add(zone.trim());
                }
            });
        });
        if (zones.size > 0) {
            entities.zones = Array.from(zones);
        }

        // استخراج أرقام القرارات
        const decisions = new Set();
        ENTITY_PATTERNS.DECISION_NUMBER.forEach(pattern => {
            const matches = [...normalized.matchAll(pattern)];
            matches.forEach(m => {
                if (m[1]) {
                    decisions.add(m[1]);
                }
            });
        });
        if (decisions.size > 0) {
            entities.decisions = Array.from(decisions);
        }

        // استخراج القطاعات
        const sectors = new Set();
        ENTITY_PATTERNS.SECTOR.forEach(pattern => {
            const matches = [...normalized.matchAll(pattern)];
            matches.forEach(m => {
                if (m[1]) {
                    sectors.add(m[1]);
                }
            });
        });
        if (sectors.size > 0) {
            entities.sectors = Array.from(sectors);
        }

        return entities;
    }

    /**
     * تحليل النية المتقدم
     */
    function parseIntent(query, history = []) {
        const normalized = normalizeArabic(query);
        const entities = extractEntities(query);
        const intents = [];

        console.log(`🔍 تحليل: "${query}"`);

        // فحص كل نمط من أنماط النوايا
        for (const [intentName, pattern] of Object.entries(INTENT_PATTERNS)) {
            let score = 0;
            let matchedKeywords = [];
            let matchedPatterns = [];
            let negativeMatches = 0;

            // فحص الأنماط regex (أولوية عالية)
            if (pattern.patterns) {
                pattern.patterns.forEach(regex => {
                    if (regex.test(query)) {
                        score += 0.5 * pattern.weight;
                        matchedPatterns.push('pattern');
                    }
                });
            }

            // فحص الكلمات المفتاحية
            pattern.keywords.forEach(keyword => {
                const keywordNorm = normalizeArabic(keyword);
                if (normalized.includes(keywordNorm)) {
                    score += 0.3 * pattern.weight;
                    matchedKeywords.push(keyword);
                }
            });

            // فحص الكلمات السلبية (تقلل الثقة)
            if (pattern.negativeKeywords) {
                pattern.negativeKeywords.forEach(negKeyword => {
                    const negKeywordNorm = normalizeArabic(negKeyword);
                    if (normalized.includes(negKeywordNorm)) {
                        negativeMatches++;
                        score -= 0.15;
                    }
                });
            }

            // مكافأة تطابق الكيانات
            let entityBonus = 0;
            if (intentName.startsWith('ACTIVITY') && entities.activities) {
                entityBonus += 0.1;
            }
            if (intentName.startsWith('INDUSTRIAL_ZONE') && entities.zones) {
                entityBonus += 0.15;
            }
            if (intentName.startsWith('DECISION104') && entities.decisions) {
                entityBonus += 0.15;
            }
            score += entityBonus;

            // حساب الثقة النهائية
            const maxScore = (pattern.patterns?.length || 0) * 0.5 * pattern.weight +
                           pattern.keywords.length * 0.3 * pattern.weight +
                           0.25; // مكافأة الكيانات
            
            const confidence = maxScore > 0 ? Math.min(1.0, score / maxScore) : 0;

            if (confidence >= pattern.threshold) {
                intents.push({
                    name: intentName,
                    confidence,
                    matchedKeywords,
                    matchedPatterns,
                    negativeMatches,
                    threshold: pattern.threshold,
                    rawScore: score
                });
            }
        }

        // ترتيب حسب الثقة
        intents.sort((a, b) => b.confidence - a.confidence);

        // معالجة أسئلة المتابعة
        const isFollowUp = detectFollowUp(query, history);
        if (isFollowUp && history.length > 0 && intents.length === 0) {
            const lastIntent = history[history.length - 1].intent;
            if (lastIntent && lastIntent.primary) {
                intents.push({
                    name: lastIntent.primary.name,
                    confidence: 0.55,
                    matchedKeywords: [],
                    isInherited: true,
                    inheritedFrom: 'history'
                });
            }
        }

        // النية الافتراضية
        if (intents.length === 0) {
            intents.push({
                name: 'GENERAL',
                confidence: 0.40,
                matchedKeywords: [],
                isDefault: true
            });
        }

        const result = {
            primary: intents[0],
            all: intents,
            entities,
            isFollowUp,
            normalized,
            queryType: classifyQueryType(query, intents[0])
        };

        console.log(`✅ النية: ${result.primary.name} (${(result.primary.confidence * 100).toFixed(0)}%)`);
        if (Object.keys(entities).length > 0) {
            console.log(`📦 الكيانات:`, entities);
        }

        return result;
    }

    /**
     * تصنيف نوع السؤال
     */
    function classifyQueryType(query, primaryIntent) {
        const normalized = normalizeArabic(query);
        
        if (/^(ما|ماذا|من|اين|متى|كيف|لماذا|هل)/i.test(query)) {
            if (/^(ما|ماذا)\s/i.test(query)) return 'what';
            if (/^من\s/i.test(query)) return 'who';
            if (/^اين\s/i.test(query)) return 'where';
            if (/^متى\s/i.test(query)) return 'when';
            if (/^كيف\s/i.test(query)) return 'how';
            if (/^لماذا\s/i.test(query)) return 'why';
            if (/^هل\s/i.test(query)) return 'yes_no';
        }
        
        if (normalized.includes('اريد') || normalized.includes('ابحث عن') || normalized.includes('احتاج')) {
            return 'request';
        }
        
        return 'statement';
    }

    /**
     * كشف أسئلة المتابعة
     */
    function detectFollowUp(query, history) {
        if (history.length === 0) return false;

        const normalized = normalizeArabic(query);
        
        // مؤشرات الإشارة
        const referenceIndicators = [
            'هذا', 'هذه', 'ذلك', 'تلك', 'نفس', 'السابق', 'المذكور',
            'السؤال السابق', 'النشاط السابق', 'المنطقة السابقة'
        ];
        
        if (referenceIndicators.some(ind => normalized.includes(normalizeArabic(ind)))) {
            return true;
        }

        // مؤشرات الاستمرارية
        const continuityIndicators = [
            'وماذا عن', 'ماذا عن', 'أيضا', 'كذلك', 'كمان', 'بالإضافة',
            'وأيضا', 'وكذلك'
        ];
        
        if (continuityIndicators.some(ind => normalized.includes(normalizeArabic(ind)))) {
            return true;
        }

        // أسئلة قصيرة بدون كيانات (تشير للسياق)
        const words = normalized.split(/\s+/).filter(w => !STOP_WORDS.has(w));
        if (words.length <= 3 && history.length > 0) {
            return true;
        }

        return false;
    }

    /**
     * بناء السياق من المحادثة
     */
    function buildContext(history) {
        if (history.length === 0) return null;

        const recentHistory = history.slice(-5); // آخر 5 تبادلات
        const context = {
            entities: {},
            topics: [],
            keywords: [],
            lastIntent: null,
            dominantSource: null
        };

        const sourceCount = { activities: 0, industrial: 0, decision104: 0 };

        recentHistory.forEach((item, idx) => {
            const weight = (idx + 1) / recentHistory.length; // وزن أكبر للأحدث

            // دمج الكيانات
            if (item.entities) {
                Object.keys(item.entities).forEach(key => {
                    if (!context.entities[key]) {
                        context.entities[key] = [];
                    }
                    // إضافة مع تجنب التكرار
                    item.entities[key].forEach(entity => {
                        if (!context.entities[key].includes(entity)) {
                            context.entities[key].push(entity);
                        }
                    });
                });
            }

            // جمع المواضيع
            if (item.intent && item.intent.primary) {
                context.topics.push({
                    name: item.intent.primary.name,
                    weight: weight
                });
            }

            // تتبع المصادر المهيمنة
            if (item.sources) {
                item.sources.forEach(src => {
                    if (src.source) {
                        sourceCount[src.source] = (sourceCount[src.source] || 0) + 1;
                    }
                });
            }
        });

        // تحديد النية الأخيرة
        if (recentHistory.length > 0) {
            context.lastIntent = recentHistory[recentHistory.length - 1].intent;
        }

        // تحديد المصدر المهيمن
        const maxSource = Object.keys(sourceCount).reduce((a, b) => 
            sourceCount[a] > sourceCount[b] ? a : b
        );
        if (sourceCount[maxSource] > 0) {
            context.dominantSource = maxSource;
        }

        // إزالة التكرار في المواضيع
        context.topics = Array.from(new Set(context.topics.map(t => t.name)))
            .map(name => context.topics.find(t => t.name === name));

        return context;
    }

    /**
     * تحليل الأسئلة المعقدة
     */
    function decomposeComplexQuery(query) {
        const normalized = normalizeArabic(query);
        const subQueries = [];

        // فصل حسب الروابط
        const conjunctions = /\s+(و|أو|ثم|كذلك|بالإضافة|أيضا)\s+/g;
        const parts = normalized.split(conjunctions);
        
        parts.forEach((part, idx) => {
            const trimmed = part.trim();
            if (trimmed.length > 15) { // طول معقول
                subQueries.push({
                    text: trimmed,
                    order: idx,
                    isSubQuery: true,
                    confidence: 1.0 - (idx * 0.1) // الأولى أعلى ثقة
                });
            }
        });

        // إذا كان سؤال مركب (أكثر من علامة استفهام)
        const questionMarks = (query.match(/؟/g) || []).length;
        if (questionMarks > 1) {
            const questions = query.split(/؟/g).filter(q => q.trim());
            questions.forEach((q, idx) => {
                if (q.trim().length > 10) {
                    subQueries.push({
                        text: q.trim() + '؟',
                        order: idx,
                        isSubQuery: true,
                        isQuestion: true,
                        confidence: 0.9
                    });
                }
            });
        }

        return subQueries.length > 1 ? subQueries : null;
    }

    /**
     * الحصول على عتبة ديناميكية
     */
    function getDynamicThreshold(intent, context = null) {
        const baseThresholds = {
            ACTIVITY_LICENSE: 0.15,
            ACTIVITY_AUTHORITY: 0.15,
            ACTIVITY_LAW: 0.18,
            ACTIVITY_GUIDE: 0.15,
            ACTIVITY_LOCATION: 0.15,
            ACTIVITY_TECHNICAL: 0.18,
            ACTIVITY_DESCRIPTION: 0.15,
            INDUSTRIAL_ZONE: 0.20,
            INDUSTRIAL_ZONE_AUTHORITY: 0.20,
            INDUSTRIAL_ZONE_DECISION: 0.20,
            INDUSTRIAL_ZONE_AREA: 0.20,
            INDUSTRIAL_ZONE_CHECK: 0.22,
            DECISION104: 0.18,
            DECISION104_SECTOR: 0.20,
            GENERAL: 0.12
        };

        let threshold = baseThresholds[intent] || 0.15;

        // تعديل حسب السياق
        if (context) {
            if (context.topics && context.topics.length > 2) {
                threshold *= 0.9; // خفض العتبة للمحادثات الطويلة
            }
            if (context.entities && Object.keys(context.entities).length > 0) {
                threshold *= 0.95; // خفض قليلاً مع وجود كيانات
            }
        }

        return threshold;
    }

    /**
     * توقع السؤال التالي
     */
    function predictNextQuestion(currentIntent, entities, history) {
        const predictions = [];

        if (!currentIntent) return predictions;

        const intentName = currentIntent.name;

        // توقعات حسب النية الحالية
        if (intentName === 'ACTIVITY_LICENSE') {
            predictions.push('ما هي الجهات المختصة؟');
            predictions.push('ما هي القوانين المنظمة؟');
            predictions.push('أين يمكن مزاولة النشاط؟');
        }
        else if (intentName === 'ACTIVITY_AUTHORITY') {
            predictions.push('ما هي التراخيص المطلوبة؟');
            predictions.push('ما هو الدليل الإرشادي؟');
        }
        else if (intentName.startsWith('INDUSTRIAL_ZONE')) {
            predictions.push('ما هي الأنشطة الممكنة في هذه المنطقة؟');
            predictions.push('كيف أحصل على مكان في المنطقة؟');
        }
        else if (intentName.startsWith('DECISION104')) {
            predictions.push('ما هي الحوافز المتاحة؟');
            predictions.push('ما هي شروط الاستفادة؟');
        }

        return predictions.slice(0, 3);
    }

    return {
        normalizeArabic,
        extractEntities,
        parseIntent,
        detectFollowUp,
        buildContext,
        decomposeComplexQuery,
        getDynamicThreshold,
        predictNextQuestion,
        classifyQueryType
    };
})();
