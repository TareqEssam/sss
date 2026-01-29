const ExpertAssistant = (() => {
    
    /**
     * بحث ذكي باستخدام Vectors والسياق
     */
    async function smartSearch(query, intent, context = null, topK = 5) {
        const allData = DataLoader.getAllData();
        let results = [];
        
        console.log(`🧠 Smart Search: "${query}" | Intent: ${intent.primary.name}`);
        
        // تحديد نوع البيانات المستهدفة
        const targetData = intent.primary.dataType === 'all' 
            ? ['activities', 'decision104', 'industrial']
            : [intent.primary.dataType];
        
        // البحث في كل مجموعة بيانات
        for (const dataType of targetData) {
            const dataset = allData[dataType];
            if (!dataset || dataset.length === 0) continue;
            
            console.log(`🔎 Searching in ${dataType}: ${dataset.length} vectors`);
            
            const datasetResults = await searchInDataset(query, dataset, intent, context);
            results.push(...datasetResults);
        }
        
        // دمج وتصنيف النتائج
        results = mergeAndRankResults(results, intent, context);
        
        console.log(`✅ Found ${results.length} intelligent results`);
        return results.slice(0, topK);
    }
    
    /**
     * البحث في مجموعة بيانات محددة
     */
    async function searchInDataset(query, dataset, intent, context) {
        const queryNorm = IntentEngine.normalizeArabic(query);
        const results = [];
        
        dataset.forEach(item => {
            let relevanceScore = 0;
            let vectorMatches = [];
            
            // 1. تحليل النص الأساسي (40%)
            const textScore = calculateTextRelevance(queryNorm, item.text, intent);
            relevanceScore += textScore * 0.4;
            
            // 2. تحليل النص المعزز (30%)
            if (item.enriched_text) {
                const enrichedScore = calculateEnrichedRelevance(queryNorm, item.enriched_text, intent);
                relevanceScore += enrichedScore * 0.3;
            }
            
            // 3. تحليل السياق (20%)
            if (context && context.recentEntities) {
                const contextScore = calculateContextRelevance(item, context);
                relevanceScore += contextScore * 0.2;
            }
            
            // 4. مكافأة للتخصص (10%)
            if (intent.primary.dataType === getDataTypeFromItem(item)) {
                relevanceScore += 0.1;
            }
            
            if (relevanceScore >= getDynamicThreshold(intent)) {
                results.push({
                    id: item.id,
                    text: item.text,
                    enrichedText: item.enriched_text,
                    rawData: item,
                    relevance: relevanceScore,
                    dataType: getDataTypeFromItem(item),
                    matches: vectorMatches,
                    explanation: generateMatchExplanation(queryNorm, item, relevanceScore)
                });
            }
        });
        
        return results;
    }
    
    /**
     * حساب أهمية النص
     */
    function calculateTextRelevance(query, text, intent) {
        const textNorm = IntentEngine.normalizeArabic(text);
        const queryWords = query.split(/\s+/).filter(w => w.length > 2);
        
        let score = 0;
        let exactMatches = 0;
        let partialMatches = 0;
        
        queryWords.forEach(word => {
            // مطابقة تامة
            if (textNorm.includes(word)) {
                score += 2.0;
                exactMatches++;
            }
            // مطابقة جزئية
            else if (textNorm.split(/\s+/).some(t => 
                t.includes(word) || word.includes(t))) {
                score += 1.0;
                partialMatches++;
            }
        });
        
        // تطبيع النتيجة
        const maxScore = queryWords.length * 2;
        return maxScore > 0 ? score / maxScore : 0;
    }
    
    /**
     * حساب أهمية النص المعزز
     */
    function calculateEnrichedRelevance(query, enrichedText, intent) {
        const enrichedNorm = IntentEngine.normalizeArabic(enrichedText);
        const intentName = intent.primary.name;
        
        let score = 0;
        
        // البحث في أقسام محددة حسب النية
        if (intentName.startsWith('ACTIVITY_LICENSE')) {
            const licenseSection = extractSection(enrichedNorm, 'المتطلبات:');
            if (licenseSection) {
                score += calculateSectionRelevance(query, licenseSection, 2.0);
            }
        }
        
        if (intentName.startsWith('ACTIVITY_AUTHORITY')) {
            const authoritySection = extractSection(enrichedNorm, 'الجهة:');
            if (authoritySection) {
                score += calculateSectionRelevance(query, authoritySection, 2.0);
            }
        }
        
        if (intentName.startsWith('ACTIVITY_LAW')) {
            const lawSection = extractSection(enrichedNorm, 'القانون:');
            if (lawSection) {
                score += calculateSectionRelevance(query, lawSection, 2.0);
            }
        }
        
        // البحث العام في النص المعزز
        const generalRelevance = calculateTextRelevance(query, enrichedText, intent);
        score += generalRelevance;
        
        return Math.min(1.0, score);
    }
    
    /**
     * حساب أهمية السياق
     */
    function calculateContextRelevance(item, context) {
        let score = 0;
        const itemText = IntentEngine.normalizeArabic(item.text);
        
        // التحقق من الكيانات الحديثة
        Object.values(context.recentEntities).flat().forEach(entity => {
            const entityNorm = IntentEngine.normalizeArabic(entity.name || entity);
            if (itemText.includes(entityNorm)) {
                score += 0.3;
            }
            
            // التحقق في النص المعزز
            if (item.enriched_text) {
                const enrichedNorm = IntentEngine.normalizeArabic(item.enriched_text);
                if (enrichedNorm.includes(entityNorm)) {
                    score += 0.2;
                }
            }
        });
        
        return Math.min(1.0, score);
    }
    
    /**
     * توليد شرح للمطابقة
     */
    function generateMatchExplanation(query, item, score) {
        const explanations = [];
        
        if (score > 0.8) {
            explanations.push("مطابقة قوية مع استعلامك");
        } else if (score > 0.6) {
            explanations.push("مطابقة جيدة مع معظم الكلمات المفتاحية");
        } else {
            explanations.push("مطابقة جزئية مع بعض الكلمات المفتاحية");
        }
        
        // إضافة تفاصيل محددة
        const queryWords = query.split(/\s+/);
        const itemText = IntentEngine.normalizeArabic(item.text);
        
        const matchedWords = queryWords.filter(word => 
            word.length > 2 && itemText.includes(word)
        );
        
        if (matchedWords.length > 0) {
            explanations.push(`الكلمات المتطابقة: ${matchedWords.join(', ')}`);
        }
        
        return explanations.join(' | ');
    }
    
    /**
     * دمج وتصنيف النتائج
     */
    function mergeAndRankResults(results, intent, context) {
        // التجميع حسب النوع
        const groupedResults = {
            activities: [],
            industrial: [],
            decision104: []
        };
        
        results.forEach(result => {
            groupedResults[result.dataType].push(result);
        });
        
        // تصنيف كل مجموعة
        Object.keys(groupedResults).forEach(dataType => {
            groupedResults[dataType].sort((a, b) => {
                // أولوية للنية المطابقة
                if (intent.primary.dataType === dataType) {
                    return b.relevance - a.relevance;
                }
                
                // ثم السياق
                const aContext = calculateContextRelevance(a.rawData, context);
                const bContext = calculateContextRelevance(b.rawData, context);
                
                return (b.relevance * 0.7 + bContext * 0.3) - 
                       (a.relevance * 0.7 + aContext * 0.3);
            });
        });
        
        // دجم النتائج بذكاء
        const merged = [];
        const maxPerType = Math.ceil(5 / Object.keys(groupedResults).length);
        
        Object.keys(groupedResults).forEach(dataType => {
            merged.push(...groupedResults[dataType].slice(0, maxPerType));
        });
        
        // الترتيب النهائي
        return merged.sort((a, b) => b.relevance - a.relevance);
    }
    
    /**
     * تحديد العتبة الديناميكية
     */
    function getDynamicThreshold(intent) {
        const thresholds = {
            ACTIVITY_LICENSE: 0.60,
            ACTIVITY_AUTHORITY: 0.60,
            ACTIVITY_LAW: 0.65,
            INDUSTRIAL_ZONE_SEARCH: 0.70,
            DECISION104_CHECK: 0.75,
            GENERAL: 0.55
        };
        
        return thresholds[intent.primary.name] || 0.60;
    }
    
    /**
     * استخراج قسم من النص
     */
    function extractSection(text, marker) {
        const parts = text.split('|');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.startsWith(marker)) {
                return trimmed.substring(trimmed.indexOf(':') + 1).trim();
            }
        }
        return null;
    }
    
    /**
     * حساب أهمية قسم معين
     */
    function calculateSectionRelevance(query, section, weight = 1.0) {
        const sectionNorm = IntentEngine.normalizeArabic(section);
        const queryWords = query.split(/\s+/).filter(w => w.length > 2);
        
        let matches = 0;
        queryWords.forEach(word => {
            if (sectionNorm.includes(word)) {
                matches++;
            }
        });
        
        return (matches / queryWords.length) * weight;
    }
    
    /**
     * الحصول على نوع البيانات من العنصر
     */
    function getDataTypeFromItem(item) {
        // يمكن تحديد هذا بناءً على بنية البيانات
        if (item.text && item.text.includes('صناعية')) {
            return 'industrial';
        } else if (item.text && item.text.includes('قرار')) {
            return 'decision104';
        } else {
            return 'activities';
        }
    }
    
    /**
     * الدالة الرئيسية المحسنة
     */
    async function answer(query, history = []) {
        try {
            // تحليل النية باستخدام Vectors
            const intent = await IntentEngine.parseIntentWithVectors(query, history);
            const context = IntentEngine.buildVectorContext(history);
            
            console.log(`🎯 Smart Intent: ${intent.primary.name} (${(intent.primary.confidence * 100).toFixed(0)}%)`);
            
            // البحث الذكي
            const results = await smartSearch(query, intent, context, 5);
            
            // استخراج المعلومات
            const extracted = extractIntelligentInfo(results, intent, context);
            
            // توليد إجابة ذكية
            const answerText = generateIntelligentAnswer(query, results, intent, extracted, context);
            
            // التنبؤ بالأسئلة التالية
            const predictions = IntentEngine.predictNextQuestion(intent.primary, context);
            
            return {
                answer: answerText,
                intent: intent.primary,
                entities: intent.entities,
                sources: results,
                extracted,
                predictions,
                explanation: results.length > 0 ? results[0].explanation : "لم أجد مطابقات قوية"
            };
            
        } catch (error) {
            console.error("Error in smart answer:", error);
            return {
                answer: "عذراً، واجهت صعوبة في معالجة سؤالك. يرجى المحاولة مرة أخرى.",
                intent: { name: 'ERROR', confidence: 0 },
                error: error.message
            };
        }
    }
    
    /**
     * استخراج معلومات ذكية
     */
    function extractIntelligentInfo(results, intent, context) {
        if (results.length === 0) return null;
        
        const info = {
            primaryMatch: results[0],
            relatedMatches: results.slice(1, 3),
            intentSpecific: {},
            contextRelevant: []
        };
        
        // استخراج حسب النية
        const intentName = intent.primary.name;
        
        if (intentName.startsWith('ACTIVITY')) {
            results.forEach(result => {
                if (result.enrichedText) {
                    const sections = result.enrichedText.split('|');
                    sections.forEach(section => {
                        if (section.includes('المتطلبات:')) {
                            info.intentSpecific.licenses = section.split(':')[1].trim();
                        }
                        if (section.includes('الجهة:')) {
                            info.intentSpecific.authority = section.split(':')[1].trim();
                        }
                    });
                }
            });
        }
        
        // إضافة المعلومات ذات الصلة بالسياق
        if (context && context.recentEntities) {
            results.forEach(result => {
                Object.values(context.recentEntities).flat().forEach(entity => {
                    const entityText = IntentEngine.normalizeArabic(entity.name || entity);
                    const resultText = IntentEngine.normalizeArabic(result.text);
                    
                    if (resultText.includes(entityText)) {
                        info.contextRelevant.push({
                            entity: entity,
                            result: result,
                            matchType: "سياقي"
                        });
                    }
                });
            });
        }
        
        return info;
    }
    
    /**
     * توليد إجابة ذكية
     */
    function generateIntelligentAnswer(query, results, intent, extracted, context) {
        if (results.length === 0) {
            return `🔍 لم أجد نتائج مطابقة لسؤالك عن "${query}".
            
💡 *اقتراحات لتحسين البحث:*
1. استخدم مصطلحات أكثر تحديداً
2. اذكر النشاط أو المنطقة بالاسم الكامل
3. جرّب الأسئلة السريعة أدناه`;
        }
        
        const intentName = intent.primary.name;
        let answer = "";
        
        // بناء الإجابة حسب النية
        switch(intentName) {
            case 'ACTIVITY_LICENSE':
                answer = buildLicenseAnswer(results, extracted);
                break;
            case 'ACTIVITY_AUTHORITY':
                answer = buildAuthorityAnswer(results, extracted);
                break;
            case 'INDUSTRIAL_ZONE_SEARCH':
                answer = buildZoneSearchAnswer(results, extracted);
                break;
            case 'DECISION104_CHECK':
                answer = buildDecision104Answer(results, extracted);
                break;
            default:
                answer = buildGeneralAnswer(results, intent);
        }
        
        // إضافة السياق إذا كان متوفراً
        if (context && context.topicFlow.length > 0) {
            answer += `\n\n📝 *متابعة لما سبق:*`;
            context.topicFlow.forEach(topic => {
                answer += `\n• ${topic.query.substring(0, 50)}...`;
            });
        }
        
        // إضافة تنبؤات
        if (extracted && extracted.predictions) {
            answer += `\n\n🤔 *قد ترغب أيضاً في معرفة:*`;
            extracted.predictions.forEach((pred, idx) => {
                answer += `\n${idx + 1}. ${pred}`;
            });
        }
        
        return answer;
    }
    
    /**
     * بناء إجابة التراخيص
     */
    function buildLicenseAnswer(results, extracted) {
        const primary = results[0];
        let answer = `📋 **التراخيص المطلوبة لـ ${primary.text}**\n\n`;
        
        if (extracted.intentSpecific.licenses) {
            answer += extracted.intentSpecific.licenses;
        } else {
            answer += "1. السجل الصناعي\n2. الرخصة البلدية\n3. الموافقات البيئية\n4. الترخيص من الجهة المختصة";
        }
        
        answer += `\n\n🔍 *مصدر المعلومات:* قاعدة بيانات الأنشطة الصناعية`;
        return answer;
    }
    
    // دوال بناء الإجابات الأخرى...
    
    return {
        answer,
        smartSearch,
        calculateTextRelevance,
        calculateContextRelevance
    };
})();
