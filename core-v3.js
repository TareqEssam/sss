/**
 * Expert Assistant Core v3 - المستشار الخبير المتقدم
 * نظام ذكي متقدم لفهم عميق وإجابات احترافية
 */

const ExpertAssistant = (() => {
    
    // إعدادات الذكاء المتقدم
    const CONFIG = {
        SIMILARITY_THRESHOLD: 0.15,        // عتبة التشابه الأساسية
        AMBIGUITY_THRESHOLD: 0.08,         // فرق النتيجة لاعتبار النتائج متقاربة
        MIN_CONFIDENCE_CLEAR: 0.65,        // ثقة عالية - إجابة مباشرة
        MIN_CONFIDENCE_MEDIUM: 0.45,       // ثقة متوسطة - إجابة مع تحذير
        MAX_SIMILAR_RESULTS: 4,            // عدد النتائج المتقاربة للعرض
        CONTEXT_WEIGHT: 0.25,              // وزن السياق في الترتيب
        ENTITY_MATCH_BONUS: 0.15,          // مكافأة تطابق الكيانات
        EXACT_MATCH_MULTIPLIER: 1.5        // مضاعف للتطابق التام
    };

    /**
     * البحث المتقدم مع تحليل دلالي
     */
    async function searchVectors(query, dataType = 'all', intent = null, context = null) {
        const allData = DataLoader.getAllData();
        let results = [];

        // تطبيع وتحليل الاستعلام
        const queryNorm = IntentEngine.normalizeArabic(query);
        const queryWords = extractSignificantWords(queryNorm);
        const queryPhrases = extractPhrases(queryNorm);

        console.log(`🔍 Searching: "${query}"`);
        console.log(`📊 Keywords: ${queryWords.length}, Phrases: ${queryPhrases.length}`);

        // تحديد قواعد البيانات المستهدفة
        const datasets = selectDatasets(dataType, intent, allData);

        // البحث في كل قاعدة بيانات
        datasets.forEach(dataset => {
            if (!dataset.data || dataset.data.length === 0) return;

            dataset.data.forEach(item => {
                const score = calculateRelevanceScore(
                    item, 
                    queryWords, 
                    queryPhrases, 
                    queryNorm,
                    intent,
                    context
                );

                if (score.total >= CONFIG.SIMILARITY_THRESHOLD) {
                    results.push({
                        id: item.id,
                        text: item.text,
                        enrichedText: item.enriched_text,
                        score: score.total,
                        scoreBreakdown: score.breakdown,
                        source: dataset.name,
                        rawData: item,
                        matchDetails: score.details
                    });
                }
            });
        });

        // ترتيب متقدم
        results = advancedRanking(results, intent, context);
        
        // تحليل التشابه بين النتائج
        const analysisResult = analyzeResultsSimilarity(results);
        
        console.log(`✅ Found ${results.length} results`);
        if (results.length > 0) {
            console.log(`🎯 Top: "${results[0].text}" (${(results[0].score * 100).toFixed(1)}%)`);
        }
        
        return {
            results: results,
            hasAmbiguity: analysisResult.hasAmbiguity,
            similarGroups: analysisResult.groups,
            confidence: analysisResult.topConfidence
        };
    }

    /**
     * استخراج الكلمات المهمة (مع تصفية Stop Words)
     */
    function extractSignificantWords(text) {
        const stopWords = new Set([
            'في', 'من', 'الى', 'على', 'عن', 'هل', 'ما', 'هو', 'هي',
            'لا', 'نعم', 'كان', 'يكون', 'ان', 'التي', 'الذي', 'هذا', 'هذه',
            'او', 'لكن', 'ثم', 'قد', 'كل', 'بعض', 'اي', 'اين', 'متى', 'كيف',
            'لماذا', 'عند', 'مع', 'ضد', 'بين', 'حول', 'خلال', 'قبل', 'بعد',
            'فوق', 'تحت', 'امام', 'خلف', 'داخل', 'خارج', 'حتى', 'الي'
        ]);

        return text
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w))
            .map(w => w.trim())
            .filter(w => w.length > 0);
    }

    /**
     * استخراج العبارات المهمة
     */
    function extractPhrases(text) {
        const phrases = [];
        const words = text.split(/\s+/);
        
        // عبارات من كلمتين
        for (let i = 0; i < words.length - 1; i++) {
            if (words[i].length > 2 && words[i + 1].length > 2) {
                phrases.push(`${words[i]} ${words[i + 1]}`);
            }
        }
        
        // عبارات من ثلاث كلمات
        for (let i = 0; i < words.length - 2; i++) {
            if (words[i].length > 2 && words[i + 1].length > 2 && words[i + 2].length > 2) {
                phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
            }
        }
        
        return phrases;
    }

    /**
     * حساب درجة الصلة المتقدمة
     */
    function calculateRelevanceScore(item, queryWords, queryPhrases, queryFull, intent, context) {
        const textNorm = IntentEngine.normalizeArabic(item.text);
        const enrichedNorm = IntentEngine.normalizeArabic(item.enriched_text || '');
        const fullText = `${textNorm} ${enrichedNorm}`;

        let breakdown = {
            exactMatch: 0,      // تطابق تام للنص
            phraseMatch: 0,     // تطابق العبارات
            wordMatch: 0,       // تطابق الكلمات
            partialMatch: 0,    // تطابق جزئي
            contextBonus: 0,    // مكافأة السياق
            intentBonus: 0,     // مكافأة النية
            entityBonus: 0      // مكافأة الكيانات
        };

        const details = {
            matchedWords: [],
            matchedPhrases: [],
            coverage: 0,
            exactMatches: 0
        };

        // 1. تطابق تام للنص الكامل (أعلى أولوية)
        if (textNorm.includes(queryFull) || queryFull.includes(textNorm)) {
            breakdown.exactMatch = 0.40 * CONFIG.EXACT_MATCH_MULTIPLIER;
            details.exactMatches++;
        }

        // 2. تطابق العبارات
        queryPhrases.forEach(phrase => {
            if (textNorm.includes(phrase)) {
                breakdown.phraseMatch += 0.08;
                details.matchedPhrases.push(phrase);
            } else if (enrichedNorm.includes(phrase)) {
                breakdown.phraseMatch += 0.04;
                details.matchedPhrases.push(phrase);
            }
        });

        // 3. تطابق الكلمات المفردة
        queryWords.forEach(word => {
            // تطابق تام في العنوان
            if (textNorm.includes(word)) {
                breakdown.wordMatch += 0.12;
                details.matchedWords.push(word);
                details.exactMatches++;
            }
            // تطابق تام في النص المعزز
            else if (enrichedNorm.includes(word)) {
                breakdown.wordMatch += 0.06;
                details.matchedWords.push(word);
            }
            // تطابق جزئي في العنوان
            else if (textNorm.split(/\s+/).some(w => 
                w.includes(word) || word.includes(w))) {
                breakdown.partialMatch += 0.04;
                details.matchedWords.push(word);
            }
            // تطابق جزئي في النص المعزز
            else if (enrichedNorm.split(/\s+/).some(w => 
                w.includes(word) || word.includes(w))) {
                breakdown.partialMatch += 0.02;
            }
        });

        // 4. مكافأة السياق
        if (context && context.entities) {
            Object.values(context.entities).flat().forEach(entity => {
                const entityNorm = IntentEngine.normalizeArabic(entity);
                if (fullText.includes(entityNorm)) {
                    breakdown.contextBonus += CONFIG.ENTITY_MATCH_BONUS / 10;
                }
            });
        }

        // 5. مكافأة النية
        if (intent && intent.primary) {
            const intentName = intent.primary.name;
            
            if (intentName.startsWith('ACTIVITY') && item.text.includes('نشاط')) {
                breakdown.intentBonus += 0.05;
            }
            if (intentName.startsWith('INDUSTRIAL_ZONE') && 
                (item.text.includes('منطقة') || item.text.includes('صناعية'))) {
                breakdown.intentBonus += 0.05;
            }
            if (intentName.startsWith('DECISION104') && item.text.includes('104')) {
                breakdown.intentBonus += 0.05;
            }
        }

        // 6. مكافأة الكيانات المستخرجة
        if (intent && intent.entities) {
            Object.values(intent.entities).flat().forEach(entity => {
                const entityNorm = IntentEngine.normalizeArabic(entity);
                if (textNorm.includes(entityNorm)) {
                    breakdown.entityBonus += CONFIG.ENTITY_MATCH_BONUS;
                } else if (enrichedNorm.includes(entityNorm)) {
                    breakdown.entityBonus += CONFIG.ENTITY_MATCH_BONUS / 2;
                }
            });
        }

        // حساب التغطية
        details.coverage = queryWords.length > 0 ? 
            (details.matchedWords.length / queryWords.length) * 100 : 0;

        // حساب النتيجة الإجمالية
        const total = Math.min(1.0, 
            breakdown.exactMatch + 
            breakdown.phraseMatch + 
            breakdown.wordMatch + 
            breakdown.partialMatch + 
            breakdown.contextBonus + 
            breakdown.intentBonus + 
            breakdown.entityBonus
        );

        return {
            total,
            breakdown,
            details
        };
    }

    /**
     * تحديد قواعد البيانات المناسبة
     */
    function selectDatasets(dataType, intent, allData) {
        const datasets = [];

        if (dataType === 'all') {
            // ترتيب حسب النية
            if (intent && intent.primary) {
                const intentName = intent.primary.name;
                
                if (intentName.startsWith('ACTIVITY')) {
                    datasets.push({ name: 'activities', data: allData.activities, priority: 3 });
                    datasets.push({ name: 'decision104', data: allData.decision104, priority: 2 });
                    datasets.push({ name: 'industrial', data: allData.industrial, priority: 1 });
                }
                else if (intentName.startsWith('INDUSTRIAL_ZONE')) {
                    datasets.push({ name: 'industrial', data: allData.industrial, priority: 3 });
                    datasets.push({ name: 'activities', data: allData.activities, priority: 1 });
                }
                else if (intentName.startsWith('DECISION104')) {
                    datasets.push({ name: 'decision104', data: allData.decision104, priority: 3 });
                    datasets.push({ name: 'activities', data: allData.activities, priority: 2 });
                }
                else {
                    datasets.push({ name: 'activities', data: allData.activities, priority: 2 });
                    datasets.push({ name: 'decision104', data: allData.decision104, priority: 2 });
                    datasets.push({ name: 'industrial', data: allData.industrial, priority: 2 });
                }
            } else {
                datasets.push({ name: 'activities', data: allData.activities, priority: 2 });
                datasets.push({ name: 'decision104', data: allData.decision104, priority: 2 });
                datasets.push({ name: 'industrial', data: allData.industrial, priority: 2 });
            }
        } else {
            if (dataType === 'activities') {
                datasets.push({ name: 'activities', data: allData.activities, priority: 3 });
            }
            if (dataType === 'decision104') {
                datasets.push({ name: 'decision104', data: allData.decision104, priority: 3 });
            }
            if (dataType === 'industrial') {
                datasets.push({ name: 'industrial', data: allData.industrial, priority: 3 });
            }
        }

        return datasets;
    }

    /**
     * ترتيب متقدم للنتائج
     */
    function advancedRanking(results, intent, context) {
        return results.map(result => {
            let finalScore = result.score;
            let bonuses = [];

            // مكافأة الأولوية حسب المصدر
            const intentName = intent?.primary?.name || '';
            
            if (intentName.startsWith('ACTIVITY') && result.source === 'activities') {
                finalScore *= 1.15;
                bonuses.push('مصدر ملائم');
            }
            if (intentName.startsWith('INDUSTRIAL_ZONE') && result.source === 'industrial') {
                finalScore *= 1.15;
                bonuses.push('مصدر ملائم');
            }
            if (intentName.startsWith('DECISION104') && result.source === 'decision104') {
                finalScore *= 1.15;
                bonuses.push('مصدر ملائم');
            }

            // مكافأة السياق
            if (context && context.entities && result.enrichedText) {
                const enrichedNorm = IntentEngine.normalizeArabic(result.enrichedText);
                let contextMatches = 0;
                
                Object.values(context.entities).flat().forEach(entity => {
                    if (enrichedNorm.includes(IntentEngine.normalizeArabic(entity))) {
                        contextMatches++;
                    }
                });
                
                if (contextMatches > 0) {
                    finalScore *= (1 + contextMatches * 0.05);
                    bonuses.push(`سياق: ${contextMatches}`);
                }
            }

            // مكافأة التطابق التام
            if (result.matchDetails && result.matchDetails.exactMatches > 0) {
                bonuses.push(`تطابق تام: ${result.matchDetails.exactMatches}`);
            }

            return {
                ...result,
                score: Math.min(1.0, finalScore),
                bonuses,
                originalScore: result.score
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * تحليل التشابه بين النتائج
     */
    function analyzeResultsSimilarity(results) {
        if (results.length === 0) {
            return {
                hasAmbiguity: false,
                groups: [],
                topConfidence: 0
            };
        }

        const topScore = results[0].score;
        const groups = [];
        const threshold = CONFIG.AMBIGUITY_THRESHOLD;

        // تجميع النتائج المتقاربة
        let currentGroup = [results[0]];
        
        for (let i = 1; i < Math.min(results.length, CONFIG.MAX_SIMILAR_RESULTS + 2); i++) {
            const scoreDiff = topScore - results[i].score;
            
            if (scoreDiff <= threshold) {
                currentGroup.push(results[i]);
            } else if (currentGroup.length > 1) {
                break;
            }
        }

        if (currentGroup.length > 1) {
            groups.push(currentGroup);
        }

        return {
            hasAmbiguity: currentGroup.length > 1 && topScore < CONFIG.MIN_CONFIDENCE_CLEAR,
            groups: groups,
            topConfidence: topScore
        };
    }

    /**
     * استخراج المعلومات المنظمة
     */
    function extractInformation(results, intent) {
        if (results.length === 0) return null;

        const extracted = {};
        const intentName = intent?.primary?.name || '';

        results.forEach(result => {
            if (result.source === 'activities' && result.rawData) {
                const enriched = result.rawData.enriched_text || '';
                
                // استخراج كل الأقسام
                const sections = {
                    licenses: extractSection(enriched, 'المتطلبات:'),
                    authority: extractSection(enriched, 'الجهة:'),
                    law: extractSection(enriched, 'القانون:'),
                    guide: extractSection(enriched, 'الدليل:'),
                    location: extractSection(enriched, 'الموقع:'),
                    technical: extractSection(enriched, 'ملاحظات فنية:'),
                    description: extractSection(enriched, 'الإجراءات:'),
                    activity: result.text
                };

                // دمج مع النتائج الموجودة
                Object.keys(sections).forEach(key => {
                    if (sections[key] && !extracted[key]) {
                        extracted[key] = sections[key];
                    }
                });
            }
            else if (result.source === 'industrial' && result.rawData) {
                const enriched = result.rawData.enriched_text || '';
                
                extracted.zone = result.text;
                extracted.governorate = extractSection(enriched, 'المحافظة:');
                extracted.dependency = extractSection(enriched, 'التبعية:');
                extracted.area = extractSection(enriched, 'المساحة:');
                extracted.decision = extractSection(enriched, 'قرار الإنشاء:');
            }
            else if (result.source === 'decision104' && result.rawData) {
                extracted.decision104 = result.text;
                
                const enriched = result.rawData.enriched_text || '';
                const sectorMatch = enriched.match(/قطاع\s*([أب])/);
                if (sectorMatch) {
                    extracted.sector = sectorMatch[1];
                }
            }
        });

        return extracted;
    }

    /**
     * استخراج قسم من النص
     */
    function extractSection(text, header) {
        if (!text) return null;
        
        const lines = text.split('\n');
        let capturing = false;
        let content = [];
        
        for (const line of lines) {
            if (line.includes(header)) {
                capturing = true;
                continue;
            }
            if (capturing) {
                if (line.match(/^[^\s].*:$/)) {
                    break;
                }
                if (line.trim()) {
                    content.push(line.trim());
                }
            }
        }
        
        return content.length > 0 ? content.join('\n') : null;
    }

    /**
     * توليد الإجابة المتقدمة
     */
    function generateAnswer(query, searchResult, intent, extracted) {
        const { results, hasAmbiguity, similarGroups, confidence } = searchResult;

        if (results.length === 0) {
            return generateNoResultsAnswer(query, intent);
        }

        // حالة الغموض - نتائج متقاربة
        if (hasAmbiguity && similarGroups.length > 0) {
            return generateAmbiguousAnswer(query, similarGroups[0], intent);
        }

        // حالة الثقة المتوسطة
        if (confidence < CONFIG.MIN_CONFIDENCE_MEDIUM) {
            return generateLowConfidenceAnswer(query, results, intent, extracted);
        }

        // إجابة واضحة
        const intentName = intent?.primary?.name || 'GENERAL';

        if (intentName.startsWith('ACTIVITY')) {
            return generateActivityAnswer(query, results, intent, extracted);
        }
        else if (intentName.startsWith('INDUSTRIAL_ZONE')) {
            return generateIndustrialAnswer(query, results, intent, extracted);
        }
        else if (intentName.startsWith('DECISION104')) {
            return generateDecision104Answer(query, results, intent, extracted);
        }
        else {
            return generateGeneralAnswer(query, results, intent, extracted);
        }
    }

    /**
     * إجابة عند عدم وجود نتائج
     */
    function generateNoResultsAnswer(query, intent) {
        let answer = '🔍 **لم أعثر على نتائج مطابقة تمامًا**\n\n';
        answer += 'يمكنني مساعدتك بشكل أفضل إذا:\n\n';
        answer += '• حاولت إعادة صياغة السؤال بكلمات مختلفة\n';
        answer += '• استخدمت المصطلحات الرسمية للنشاط أو المنطقة\n';
        answer += '• قدمت مزيدًا من التفاصيل\n\n';
        answer += '💡 **أمثلة على الأسئلة:**\n';
        answer += '• "ما هي التراخيص المطلوبة لنشاط تصنيع الملابس؟"\n';
        answer += '• "المناطق الصناعية في محافظة القاهرة"\n';
        answer += '• "هل صناعة الأدوية في القرار 104؟"';
        
        return answer;
    }

    /**
     * إجابة عند وجود غموض
     */
    function generateAmbiguousAnswer(query, similarResults, intent) {
        let answer = '🤔 **وجدت عدة نتائج متقاربة جدًا**\n\n';
        answer += 'يرجى تحديد أي منها تقصد:\n\n';
        
        similarResults.slice(0, CONFIG.MAX_SIMILAR_RESULTS).forEach((result, idx) => {
            const confidence = (result.score * 100).toFixed(1);
            const sourceIcon = result.source === 'activities' ? '📋' : 
                             result.source === 'industrial' ? '🏭' : '💰';
            
            answer += `**${idx + 1}. ${sourceIcon} ${result.text}**\n`;
            answer += `   └─ دقة التطابق: ${confidence}%\n`;
            
            if (result.matchDetails && result.matchDetails.matchedWords.length > 0) {
                const matches = result.matchDetails.matchedWords.slice(0, 3).join('، ');
                answer += `   └─ التطابق في: ${matches}\n`;
            }
            
            answer += '\n';
        });
        
        answer += '💡 **للحصول على إجابة دقيقة:**\n';
        answer += 'اسأل عن رقم النتيجة أو أعد صياغة السؤال بمزيد من التفاصيل.';
        
        return answer;
    }

    /**
     * إجابة عند الثقة المنخفضة
     */
    function generateLowConfidenceAnswer(query, results, intent, extracted) {
        const topResult = results[0];
        const confidence = (topResult.score * 100).toFixed(1);
        
        let answer = `⚠️ **وجدت نتيجة محتملة (ثقة: ${confidence}%)**\n\n`;
        answer += `📋 **${topResult.text}**\n\n`;
        
        if (extracted) {
            if (extracted.licenses) {
                answer += `📄 **المتطلبات:**\n${extracted.licenses.substring(0, 300)}...\n\n`;
            }
            if (extracted.authority) {
                answer += `🏛️ **الجهة:**\n${extracted.authority}\n\n`;
            }
        }
        
        answer += '⚠️ **ملاحظة:** درجة التطابق متوسطة. يرجى التأكد من:\n';
        answer += '• هذا هو النشاط أو الموضوع المقصود\n';
        answer += '• المعلومات المعروضة تطابق احتياجك\n\n';
        answer += '💡 يمكنك إعادة صياغة السؤال للحصول على نتيجة أدق.';
        
        return answer;
    }

    /**
     * إجابة تفصيلية للأنشطة
     */
    function generateActivityAnswer(query, results, intent, extracted) {
        const intentName = intent?.primary?.name || '';
        const topResult = results[0];
        const confidence = (topResult.score * 100).toFixed(1);
        
        let answer = `✅ **${topResult.text}**\n`;
        answer += `└─ دقة التطابق: ${confidence}%\n\n`;
        
        // إذا لم يكن هناك extracted أو كان فارغاً
        if (!extracted || Object.keys(extracted).length === 0) {
            answer += '⚠️ **المعلومات التفصيلية غير متوفرة حالياً**\n\n';
            answer += 'يمكنك:\n';
            answer += '• تحديد السؤال بشكل أكثر دقة\n';
            answer += '• السؤال عن نشاط آخر\n';
            answer += '• التواصل مع الهيئة مباشرة\n';
            return answer;
        }
        
        // حسب نوع السؤال
        if (intentName.includes('LICENSE') && extracted?.licenses) {
            answer += `📋 **التراخيص والمتطلبات:**\n${extracted.licenses}\n\n`;
        }
        
        if (intentName.includes('AUTHORITY') && extracted?.authority) {
            answer += `🏛️ **الجهات المختصة:**\n${extracted.authority}\n\n`;
        }
        
        if (intentName.includes('LAW') && extracted?.law) {
            answer += `⚖️ **السند التشريعي:**\n${extracted.law}\n\n`;
        }
        
        if (intentName.includes('GUIDE') && extracted?.guide) {
            answer += `📖 **الدليل الإرشادي:**\n${extracted.guide}\n\n`;
        }
        
        if (intentName.includes('LOCATION') && extracted?.location) {
            answer += `📍 **الموقع الملائم:**\n${extracted.location}\n\n`;
        }
        
        if (intentName.includes('TECHNICAL') && extracted?.technical) {
            answer += `🔧 **النقاط الفنية للمعاينة:**\n`;
            const tech = extracted.technical;
            answer += tech.length > 1500 ? tech.substring(0, 1500) + '...\n\n' : tech + '\n\n';
            if (tech.length > 1500) {
                answer += '💬 *اسأل عن نقطة معينة للحصول على تفاصيل أكثر*\n\n';
            }
        }
        
        if (intentName.includes('DESCRIPTION') && extracted?.description) {
            answer += `📝 **توصيف الإجراءات:**\n${extracted.description}\n\n`;
        }
        
        // إذا لم يكن سؤال محدد أو السؤال محدد لكن لا توجد بيانات
        let hasDisplayedInfo = false;
        
        if (intentName.includes('LICENSE') && extracted?.licenses) hasDisplayedInfo = true;
        if (intentName.includes('AUTHORITY') && extracted?.authority) hasDisplayedInfo = true;
        if (intentName.includes('LAW') && extracted?.law) hasDisplayedInfo = true;
        if (intentName.includes('GUIDE') && extracted?.guide) hasDisplayedInfo = true;
        if (intentName.includes('LOCATION') && extracted?.location) hasDisplayedInfo = true;
        if (intentName.includes('TECHNICAL') && extracted?.technical) hasDisplayedInfo = true;
        if (intentName.includes('DESCRIPTION') && extracted?.description) hasDisplayedInfo = true;
        
        // إذا لم نعرض أي معلومات محددة، اعرض ملخص عام
        if (!hasDisplayedInfo) {
            if (extracted.licenses) {
                answer += `📋 **المتطلبات:**\n${extracted.licenses.substring(0, 600)}${extracted.licenses.length > 600 ? '...' : ''}\n\n`;
            }
            if (extracted.authority) {
                answer += `🏛️ **الجهة المختصة:**\n${extracted.authority}\n\n`;
            }
            if (extracted.law) {
                answer += `⚖️ **السند القانوني:**\n${extracted.law.substring(0, 300)}${extracted.law.length > 300 ? '...' : ''}\n\n`;
            }
            
            // إذا لم يكن هناك أي معلومات
            if (!extracted.licenses && !extracted.authority && !extracted.law) {
                answer += '📝 **المعلومات المتاحة:**\n';
                answer += 'النشاط موجود في قاعدة البيانات، لكن التفاصيل محدودة حالياً.\n\n';
            }
            
            answer += '💡 **يمكنني إخبارك المزيد عن:**\n';
            if (extracted.licenses) answer += '• التراخيص والإجراءات التفصيلية\n';
            if (extracted.authority) answer += '• الجهات المختصة\n';
            if (extracted.law) answer += '• القوانين واللوائح المنظمة\n';
            if (extracted.technical) answer += '• النقاط الفنية للمعاينة\n';
            if (extracted.location) answer += '• الأماكن المناسبة لممارسة النشاط\n';
        }
        
        return answer;
    }

    /**
     * إجابة تفصيلية للمناطق الصناعية
     */
    function generateIndustrialAnswer(query, results, intent, extracted) {
        const intentName = intent?.primary?.name || '';
        const queryNorm = IntentEngine.normalizeArabic(query);
        
        // سؤال عن العدد؟
        if (queryNorm.includes('كم عدد') || queryNorm.includes('عدد')) {
            let answer = `📊 **إجمالي المناطق الصناعية: ${results.length} منطقة**\n\n`;
            
            if (intent.entities && intent.entities.governorates) {
                answer += `📍 في محافظة ${intent.entities.governorates[0]}\n\n`;
            }
            
            answer += '🏭 **قائمة المناطق:**\n\n';
            results.slice(0, 15).forEach((result, idx) => {
                const gov = extractSection(result.enrichedText, 'المحافظة:');
                answer += `${idx + 1}. ${result.text}`;
                if (gov) answer += ` - ${gov}`;
                answer += '\n';
            });
            
            if (results.length > 15) {
                answer += `\n... و ${results.length - 15} منطقة أخرى\n`;
            }
            
            answer += '\n💡 **للحصول على تفاصيل منطقة معينة:**\n';
            answer += 'اسأل عن اسم المنطقة مثل: "المنطقة الصناعية بالعاشر من رمضان"';
            
            return answer;
        }
        
        // حالة منطقة واحدة محددة
        if (results.length === 1 || (results[0].score - results[1]?.score > 0.15)) {
            const zone = results[0];
            const confidence = (zone.score * 100).toFixed(1);
            
            let answer = `✅ **${zone.text}**\n`;
            answer += `└─ دقة التطابق: ${confidence}%\n\n`;
            
            if (extracted) {
                if (intentName.includes('AUTHORITY') && extracted.dependency) {
                    answer += `🏛️ **جهة الولاية:**\n${extracted.dependency}\n\n`;
                }
                else if (intentName.includes('DECISION') && extracted.decision) {
                    answer += `📜 **قرار الإنشاء:**\n${extracted.decision}\n\n`;
                }
                else if (intentName.includes('AREA') && extracted.area) {
                    answer += `📐 **المساحة:**\n${extracted.area}\n\n`;
                }
                else if (intentName.includes('CHECK')) {
                    answer += `✅ نعم، هذه منطقة صناعية معتمدة\n\n`;
                    if (extracted.governorate) answer += `📍 **المحافظة:** ${extracted.governorate}\n`;
                    if (extracted.dependency) answer += `🏛️ **التبعية:** ${extracted.dependency}\n`;
                    if (extracted.area) answer += `📐 **المساحة:** ${extracted.area}\n`;
                    if (extracted.decision) answer += `📜 **القرار:** ${extracted.decision}\n`;
                }
                else {
                    // معلومات كاملة
                    if (extracted.governorate) answer += `📍 **المحافظة:** ${extracted.governorate}\n`;
                    if (extracted.dependency) answer += `🏛️ **جهة الولاية:** ${extracted.dependency}\n`;
                    if (extracted.area) answer += `📐 **المساحة:** ${extracted.area}\n`;
                    if (extracted.decision) answer += `📜 **قرار الإنشاء:** ${extracted.decision}\n`;
                }
            }
            
            return answer;
        }
        
        // حالة مناطق متعددة
        let answer = `🏭 **وجدت ${results.length} منطقة صناعية`;
        
        // إضافة المحافظة إذا كانت محددة
        if (intent.entities && intent.entities.governorates && intent.entities.governorates.length > 0) {
            answer += ` في ${intent.entities.governorates[0]}`;
        }
        
        answer += ':**\n\n';
        
        results.slice(0, 8).forEach((result, idx) => {
            const confidence = (result.score * 100).toFixed(1);
            answer += `**${idx + 1}. ${result.text}** _(${confidence}%)_\n`;
            
            // معلومات مختصرة
            if (result.enrichedText) {
                const gov = extractSection(result.enrichedText, 'المحافظة:');
                const dep = extractSection(result.enrichedText, 'التبعية:');
                if (gov) answer += `   └─ ${gov}\n`;
                if (dep) answer += `   └─ ${dep}\n`;
            }
            answer += '\n';
        });
        
        answer += '💡 **للحصول على تفاصيل كاملة:**\n';
        answer += 'اسأل عن اسم المنطقة المحددة، مثل: "منطقة العاشر من رمضان"';
        
        return answer;
    }

    /**
     * إجابة تفصيلية للقرار 104
     */
    function generateDecision104Answer(query, results, intent, extracted) {
        if (results.length === 0) {
            return '❌ **لم أجد هذا النشاط في القرار 104**\n\n' +
                   '💡 يرجى التأكد من:\n' +
                   '• المصطلح الدقيق للنشاط\n' +
                   '• محاولة استخدام كلمات بديلة\n' +
                   '• السؤال عن قطاع النشاط العام';
        }
        
        const topResult = results[0];
        const confidence = (topResult.score * 100).toFixed(1);
        
        let answer = `✅ **نعم، هذا النشاط وارد في القرار 104**\n\n`;
        answer += `📋 **النشاط:** ${topResult.text}\n`;
        answer += `└─ دقة التطابق: ${confidence}%\n\n`;
        
        if (extracted && extracted.sector) {
            const sectorInfo = extracted.sector === 'أ' ? {
                name: 'قطاع أ',
                desc: 'الأولوية العليا',
                incentives: 'حوافز أكبر وإعفاءات ضريبية ممتدة'
            } : {
                name: 'قطاع ب',
                desc: 'الأولوية المتوسطة',
                incentives: 'حوافز وإعفاءات قياسية'
            };
            
            answer += `📊 **${sectorInfo.name}** - ${sectorInfo.desc}\n`;
            answer += `└─ ${sectorInfo.incentives}\n\n`;
        }
        
        if (confidence < CONFIG.MIN_CONFIDENCE_CLEAR) {
            answer += '⚠️ **ملاحظة:** يرجى التأكد من مطابقة اسم النشاط تمامًا للحصول على معلومات دقيقة.\n\n';
        }
        
        answer += '💡 **للمزيد من المعلومات:**\n';
        answer += '• اسأل عن قطاع النشاط (أ أو ب)\n';
        answer += '• اسأل عن الحوافز المتاحة\n';
        answer += '• اسأل عن شروط الحصول على الحوافز';
        
        return answer;
    }

    /**
     * إجابة عامة
     */
    function generateGeneralAnswer(query, results, intent, extracted) {
        let answer = `🔍 **وجدت ${results.length} نتيجة مرتبطة:**\n\n`;
        
        // تصنيف النتائج
        const bySource = {
            activities: results.filter(r => r.source === 'activities'),
            industrial: results.filter(r => r.source === 'industrial'),
            decision104: results.filter(r => r.source === 'decision104')
        };
        
        if (bySource.activities.length > 0) {
            answer += '📋 **الأنشطة:**\n';
            bySource.activities.slice(0, 3).forEach((r, idx) => {
                const conf = (r.score * 100).toFixed(1);
                answer += `${idx + 1}. ${r.text} _(${conf}%)_\n`;
            });
            answer += '\n';
        }
        
        if (bySource.industrial.length > 0) {
            answer += '🏭 **المناطق الصناعية:**\n';
            bySource.industrial.slice(0, 3).forEach((r, idx) => {
                const conf = (r.score * 100).toFixed(1);
                answer += `${idx + 1}. ${r.text} _(${conf}%)_\n`;
            });
            answer += '\n';
        }
        
        if (bySource.decision104.length > 0) {
            answer += '💰 **أنشطة القرار 104:**\n';
            bySource.decision104.slice(0, 3).forEach((r, idx) => {
                const conf = (r.score * 100).toFixed(1);
                answer += `${idx + 1}. ${r.text} _(${conf}%)_\n`;
            });
            answer += '\n';
        }
        
        answer += '💡 **للحصول على معلومات تفصيلية:**\n';
        answer += 'اختر أحد النتائج واسأل عنها بالتحديد.';
        
        return answer;
    }

    /**
     * الدالة الرئيسية للإجابة
     */
    async function answer(query, history = []) {
        console.log('\n🎯 ===== معالجة جديدة =====');
        console.log(`📝 السؤال: "${query}"`);
        
        // 1. تحليل النية والسياق
        const intent = IntentEngine.parseIntent(query, history);
        const context = IntentEngine.buildContext(history);
        
        console.log(`🧠 النية: ${intent.primary.name} (${(intent.primary.confidence * 100).toFixed(0)}%)`);
        if (intent.entities && Object.keys(intent.entities).length > 0) {
            console.log(`🏷️ الكيانات:`, intent.entities);
        }
        
        // 2. تحديد نوع البحث
        let dataType = 'all';
        const intentName = intent.primary.name;
        
        if (intentName.startsWith('ACTIVITY')) {
            dataType = 'activities';
        } else if (intentName.startsWith('INDUSTRIAL_ZONE')) {
            dataType = 'industrial';
        } else if (intentName.startsWith('DECISION104')) {
            dataType = 'decision104';
        }
        
        // 3. البحث المتقدم
        const searchResult = await searchVectors(query, dataType, intent, context);
        
        // 4. استخراج المعلومات
        const extracted = extractInformation(searchResult.results, intent);
        
        // 5. توليد الإجابة
        const answerText = generateAnswer(query, searchResult, intent, extracted);
        
        console.log(`✅ الإجابة جاهزة (${answerText.length} حرف)`);
        console.log('🎯 ===== انتهى =====\n');
        
        return {
            answer: answerText,
            intent,
            entities: intent.entities,
            sources: searchResult.results.slice(0, 5),
            hasAmbiguity: searchResult.hasAmbiguity,
            confidence: searchResult.confidence,
            similarGroups: searchResult.similarGroups,
            extracted
        };
    }

    return {
        answer,
        searchVectors
    };
})();
