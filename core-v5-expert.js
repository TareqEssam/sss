/**
 * Expert Assistant Core v5 - المستشار الخبير الذكي المحسّن
 * نظام ذكي متقدم يجيب على الأسئلة بدقة واحترافية كخبير حقيقي
 * مع إصلاح جميع الأخطاء وتحسين الأداء
 */

const ExpertAssistant = (() => {
    
    // إعدادات الذكاء المتقدم
    const CONFIG = {
        SIMILARITY_THRESHOLD: 0.12,
        AMBIGUITY_THRESHOLD: 0.08,
        MIN_CONFIDENCE_CLEAR: 0.65,
        MIN_CONFIDENCE_MEDIUM: 0.45,
        MAX_SIMILAR_RESULTS: 5,
        CONTEXT_WEIGHT: 0.25,
        ENTITY_MATCH_BONUS: 0.20,
        EXACT_MATCH_MULTIPLIER: 1.8,
        SEMANTIC_WEIGHT: 0.3
    };

    // سياق المحادثة للأسئلة المتتابعة
    let conversationContext = {
        lastQuery: null,
        lastIntent: null,
        lastResults: null,
        lastEntities: null,
        history: []
    };

    /**
     * معالجة السؤال الرئيسية - محسّنة
     */
    async function processQuery(query) {
        const startTime = performance.now();
        
        try {
            console.log('🚀 بدء معالجة السؤال:', query);

            // تحليل النية والكيانات
            const intent = IntentEngine.parseIntent(query, conversationContext.history);
            const entities = IntentEngine.extractEntities(query);
            
            console.log('🎯 النية المكتشفة:', intent.primary?.name);
            console.log('🏷️ الكيانات:', entities);

            // بناء السياق
            const context = IntentEngine.buildContext(conversationContext.history);
            
            // البحث الذكي
            const searchResult = await searchVectors(query, 'all', intent, context);
            
            // حفظ السياق
            conversationContext.lastQuery = query;
            conversationContext.lastIntent = intent;
            conversationContext.lastResults = searchResult.results;
            conversationContext.lastEntities = entities;
            
            conversationContext.history.push({
                query: query,
                intent: intent,
                entities: entities,
                results: searchResult.results.slice(0, 3),
                timestamp: Date.now()
            });
            
            // الحفاظ على آخر 5 محادثات فقط
            if (conversationContext.history.length > 5) {
                conversationContext.history.shift();
            }

            // توليد الإجابة الذكية
            let answer = '';
            
            if (searchResult.results.length === 0) {
                answer = generateNoResultsExpertAnswer(query, intent);
            } else if (searchResult.hasAmbiguity && searchResult.results.length > 1) {
                answer = generateClarificationAnswer(query, searchResult.results, intent);
            } else {
                answer = await generateExpertAnswer(query, searchResult.results, intent, entities);
            }

            const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ اكتمل في ${processingTime} ثانية`);

            return {
                answer: answer,
                intent: intent,
                entities: entities,
                results: searchResult.results.slice(0, 5),
                confidence: searchResult.confidence,
                hasAmbiguity: searchResult.hasAmbiguity,
                processingTime: processingTime
            };
            
        } catch (error) {
            console.error('❌ خطأ في المعالجة:', error);
            return {
                answer: 'عذراً، حدث خطأ أثناء معالجة السؤال. الرجاء المحاولة مرة أخرى.',
                intent: null,
                entities: {},
                results: [],
                confidence: 0,
                hasAmbiguity: false,
                processingTime: 0
            };
        }
    }

    /**
     * البحث المتقدم مع تحليل دلالي محسّن
     */
    async function searchVectors(query, dataType = 'all', intent = null, context = null) {
        const allData = DataLoader.getAllData();
        let results = [];

        const queryNorm = IntentEngine.normalizeArabic(query);
        const queryWords = extractSignificantWords(queryNorm);
        const queryPhrases = extractPhrases(queryNorm);

        console.log(`🔍 البحث عن: "${query}"`);
        console.log(`📊 كلمات مفتاحية: ${queryWords.length}, عبارات: ${queryPhrases.length}`);

        const datasets = selectDatasets(dataType, intent, allData);

        datasets.forEach(dataset => {
            if (!dataset.data || dataset.data.length === 0) return;

            dataset.data.forEach(item => {
                const score = calculateRelevanceScore(
                    item, 
                    queryWords, 
                    queryPhrases, 
                    queryNorm,
                    intent,
                    context,
                    dataset.priority || 1
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

        results = advancedRanking(results, intent, context);
        const analysisResult = analyzeResultsSimilarity(results);
        
        console.log(`✅ تم إيجاد ${results.length} نتيجة`);
        if (results.length > 0) {
            console.log(`🎯 الأعلى: "${results[0].text}" (${(results[0].score * 100).toFixed(1)}%)`);
        }
        
        return {
            results: results,
            hasAmbiguity: analysisResult.hasAmbiguity,
            similarGroups: analysisResult.groups,
            confidence: analysisResult.topConfidence
        };
    }

    /**
     * استخراج الكلمات المهمة
     */
    function extractSignificantWords(text) {
        const stopWords = new Set([
            'في', 'من', 'الى', 'إلى', 'على', 'علي', 'عن', 'هل', 'ما', 'هو', 'هي',
            'لا', 'نعم', 'كان', 'يكون', 'ان', 'أن', 'إن', 'التي', 'الذي', 
            'هذا', 'هذه', 'ذلك', 'تلك', 'او', 'أو', 'لكن', 'ثم', 'قد', 'كل',
            'بعض', 'اي', 'أي', 'اين', 'أين', 'متى', 'كيف', 'لماذا', 'عند',
            'مع', 'ضد', 'بين', 'حول', 'خلال', 'قبل', 'بعد', 'فوق', 'تحت',
            'امام', 'أمام', 'خلف', 'داخل', 'خارج', 'حتى', 'الي', 'إلي'
        ]);

        return text
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w))
            .map(w => w.trim());
    }

    /**
     * استخراج العبارات المهمة (2-3 كلمات)
     */
    function extractPhrases(text) {
        const phrases = [];
        const words = text.split(/\s+/);
        
        for (let i = 0; i < words.length - 1; i++) {
            // عبارات ثنائية
            phrases.push(words[i] + ' ' + words[i + 1]);
            
            // عبارات ثلاثية
            if (i < words.length - 2) {
                phrases.push(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
            }
        }
        
        return phrases;
    }

    /**
     * اختيار قواعد البيانات المناسبة حسب النية
     */
    function selectDatasets(dataType, intent, allData) {
        if (dataType !== 'all') {
            return [{ name: dataType, data: allData[dataType], priority: 3 }];
        }

        const intentName = intent?.primary?.name || '';
        
        // تحديد الأولويات حسب النية
        if (intentName.includes('DECISION104')) {
            return [
                { name: 'decision104', data: allData.decision104, priority: 3 },
                { name: 'activities', data: allData.activities, priority: 1.5 }
            ];
        }
        
        if (intentName.includes('INDUSTRIAL')) {
            return [
                { name: 'industrial', data: allData.industrial, priority: 3 },
                { name: 'activities', data: allData.activities, priority: 1 }
            ];
        }
        
        if (intentName.includes('ACTIVITY')) {
            return [
                { name: 'activities', data: allData.activities, priority: 3 },
                { name: 'decision104', data: allData.decision104, priority: 1.2 },
                { name: 'industrial', data: allData.industrial, priority: 0.8 }
            ];
        }

        // بحث عام في كل القواعد
        return [
            { name: 'activities', data: allData.activities, priority: 2 },
            { name: 'industrial', data: allData.industrial, priority: 2 },
            { name: 'decision104', data: allData.decision104, priority: 2 }
        ];
    }

    /**
     * حساب درجة الصلة المحسّنة
     */
    function calculateRelevanceScore(item, queryWords, queryPhrases, queryNorm, intent, context, priority = 1) {
        const textNorm = IntentEngine.normalizeArabic(item.text);
        const enrichedNorm = IntentEngine.normalizeArabic(item.enriched_text || '');
        const combinedText = textNorm + ' ' + enrichedNorm;
        
        let score = 0;
        let breakdown = {
            exactMatch: 0,
            wordMatch: 0,
            phraseMatch: 0,
            semanticMatch: 0,
            entityMatch: 0,
            priority: 0
        };
        let matchedWords = [];
        let matchedPhrases = [];

        // 1. تطابق تام - أعلى درجة
        if (textNorm === queryNorm) {
            breakdown.exactMatch = 1.0;
            score += 1.0 * CONFIG.EXACT_MATCH_MULTIPLIER;
        } else if (textNorm.includes(queryNorm) || queryNorm.includes(textNorm)) {
            breakdown.exactMatch = 0.8;
            score += 0.8 * CONFIG.EXACT_MATCH_MULTIPLIER;
        }

        // 2. تطابق الكلمات المفتاحية
        let wordMatchScore = 0;
        queryWords.forEach(word => {
            if (combinedText.includes(word)) {
                wordMatchScore += 0.12;
                matchedWords.push(word);
                
                // مكافأة إضافية للكلمات في النص الأصلي
                if (textNorm.includes(word)) {
                    wordMatchScore += 0.03;
                }
            }
        });
        breakdown.wordMatch = Math.min(wordMatchScore, 0.7);
        score += breakdown.wordMatch;

        // 3. تطابق العبارات
        let phraseMatchScore = 0;
        queryPhrases.forEach(phrase => {
            if (combinedText.includes(phrase)) {
                phraseMatchScore += 0.25;
                matchedPhrases.push(phrase);
            }
        });
        breakdown.phraseMatch = Math.min(phraseMatchScore, 0.5);
        score += breakdown.phraseMatch;

        // 4. مكافأة تطابق الكيانات
        if (intent?.entities) {
            Object.values(intent.entities).flat().forEach(entity => {
                const entityNorm = IntentEngine.normalizeArabic(entity);
                if (combinedText.includes(entityNorm)) {
                    breakdown.entityMatch += CONFIG.ENTITY_MATCH_BONUS;
                }
            });
            score += breakdown.entityMatch;
        }

        // 5. تطبيق الأولوية
        breakdown.priority = (priority - 1) * 0.1;
        score += breakdown.priority;

        // 6. تطابق دلالي (حسب السياق)
        if (context && context.entities) {
            Object.values(context.entities).flat().forEach(contextEntity => {
                const entityNorm = IntentEngine.normalizeArabic(contextEntity);
                if (combinedText.includes(entityNorm)) {
                    breakdown.semanticMatch += CONFIG.SEMANTIC_WEIGHT * 0.2;
                }
            });
            score += breakdown.semanticMatch;
        }

        return {
            total: Math.min(score, 2.0), // سقف أعلى للسماح بالتمييز
            breakdown: breakdown,
            details: {
                matchedWords: matchedWords,
                matchedPhrases: matchedPhrases,
                matchRatio: queryWords.length > 0 ? matchedWords.length / queryWords.length : 0
            }
        };
    }

    /**
     * ترتيب متقدم للنتائج
     */
    function advancedRanking(results, intent, context) {
        return results.sort((a, b) => {
            // الأولوية الأولى: الدرجة الإجمالية
            if (Math.abs(a.score - b.score) > 0.05) {
                return b.score - a.score;
            }
            
            // الأولوية الثانية: نسبة التطابق
            const aRatio = a.matchDetails?.matchRatio || 0;
            const bRatio = b.matchDetails?.matchRatio || 0;
            if (Math.abs(aRatio - bRatio) > 0.1) {
                return bRatio - aRatio;
            }
            
            // الأولوية الثالثة: عدد الكلمات المتطابقة
            const aWords = a.matchDetails?.matchedWords?.length || 0;
            const bWords = b.matchDetails?.matchedWords?.length || 0;
            if (aWords !== bWords) {
                return bWords - aWords;
            }
            
            // الأولوية الرابعة: طول النص (الأقصر أفضل للدقة)
            return a.text.length - b.text.length;
        });
    }

    /**
     * تحليل تشابه النتائج
     */
    function analyzeResultsSimilarity(results) {
        if (results.length === 0) {
            return {
                hasAmbiguity: false,
                groups: [],
                topConfidence: 0
            };
        }

        const topScore = results[0]?.score || 0;
        const similarResults = results.filter(r => 
            Math.abs(r.score - topScore) < CONFIG.AMBIGUITY_THRESHOLD
        );

        return {
            hasAmbiguity: similarResults.length > 1 && topScore < CONFIG.MIN_CONFIDENCE_CLEAR,
            groups: similarResults.length > 1 ? [similarResults] : [],
            topConfidence: topScore
        };
    }

    /**
     * توليد إجابة خبير ذكية
     */
    async function generateExpertAnswer(query, results, intent, entities) {
        const queryNorm = IntentEngine.normalizeArabic(query);
        const topResult = results[0];
        const intentName = intent?.primary?.name || 'GENERAL';

        // استخراج المعلومات
        const extracted = extractStructuredData(topResult);

        // توليد الإجابة حسب نوع السؤال
        if (intentName.includes('INDUSTRIAL_ZONE')) {
            return generateIndustrialZoneExpertAnswer(query, results, extracted, intent, queryNorm);
        }
        
        if (intentName.includes('DECISION104')) {
            return generateDecision104ExpertAnswer(query, topResult, extracted, intent, queryNorm);
        }
        
        if (intentName.includes('ACTIVITY')) {
            return generateActivityExpertAnswer(query, topResult, extracted, intent, queryNorm);
        }

        // إجابة عامة ذكية
        return generateSmartGeneralAnswer(query, results, intent);
    }

    /**
     * استخراج البيانات المنظمة
     */
    function extractStructuredData(result) {
        const text = result.enrichedText || result.text;
        
        return {
            licenses: extractSection(text, 'التراخيص:'),
            authority: extractSection(text, 'جهة الولاية:') || extractSection(text, 'الجهة المختصة:'),
            law: extractSection(text, 'السند التشريعي:') || extractSection(text, 'القانون:'),
            guide: extractSection(text, 'الدليل الإرشادي:'),
            location: extractSection(text, 'مواقع مزاولة النشاط:'),
            technical: extractSection(text, 'النقاط الفنية:'),
            governorate: extractSection(text, 'المحافظة:'),
            dependency: extractSection(text, 'جهة الولاية:') || extractSection(text, 'التبعية:'),
            area: extractSection(text, 'المساحة:'),
            decision: extractSection(text, 'قرار الإنشاء:'),
            sector: extractSector(text)
        };
    }

    /**
     * استخراج قسم من النص
     */
    function extractSection(text, sectionHeader) {
        const regex = new RegExp(sectionHeader + '\\s*([^\\n]+)', 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * استخراج القطاع من القرار 104
     */
    function extractSector(text) {
        const match = text.match(/قطاع\s*([أب])/i);
        return match ? match[1] : null;
    }

    /**
     * إجابة خبير للأنشطة
     */
    async function generateActivityExpertAnswer(query, result, extracted, intent, queryNorm) {
        let answer = `### 📋 **${result.text}**\n\n`;

        const intentName = intent.primary?.name;

        // سؤال عن التراخيص
        if (intentName === 'ACTIVITY_LICENSE' || queryNorm.includes('ترخيص') || queryNorm.includes('تراخيص')) {
            if (extracted.licenses) {
                answer += `#### 📜 التراخيص المطلوبة:\n${extracted.licenses}\n\n`;
            }
            if (extracted.authority) {
                answer += `#### 🏛️ الجهة المختصة:\n${extracted.authority}\n\n`;
            }
            if (!extracted.licenses) {
                answer += 'لم أجد معلومات محددة عن التراخيص المطلوبة.\n\n';
            }
        }
        
        // سؤال عن الجهات
        else if (intentName === 'ACTIVITY_AUTHORITY' || queryNorm.includes('جهة') || queryNorm.includes('جهات')) {
            if (extracted.authority) {
                answer += `#### 🏛️ الجهة المختصة:\n${extracted.authority}\n\n`;
                
                if (extracted.licenses) {
                    answer += `#### 📜 التراخيص الصادرة:\n${extracted.licenses}\n\n`;
                }
            } else {
                answer += 'لم أجد معلومات عن الجهة المختصة.\n\n';
            }
        }
        
        // سؤال عن القوانين
        else if (intentName === 'ACTIVITY_LAW' || queryNorm.includes('قانون') || queryNorm.includes('تشريع')) {
            if (extracted.law) {
                answer += `#### ⚖️ السند التشريعي:\n${extracted.law}\n\n`;
            } else {
                answer += 'لم أجد معلومات عن السند التشريعي.\n\n';
            }
        }
        
        // سؤال عن المواقع
        else if (intentName === 'ACTIVITY_LOCATION' || queryNorm.includes('موقع') || queryNorm.includes('مكان') || queryNorm.includes('اين')) {
            if (extracted.location) {
                answer += `#### 📍 مواقع مزاولة النشاط:\n${extracted.location}\n\n`;
            } else {
                answer += 'لم أجد معلومات محددة عن مواقع مزاولة النشاط.\n\n';
            }
        }
        
        // سؤال عن النقاط الفنية
        else if (intentName === 'ACTIVITY_TECHNICAL' || queryNorm.includes('فني') || queryNorm.includes('معاينة') || queryNorm.includes('مساحة')) {
            if (extracted.technical) {
                answer += `#### 🔧 النقاط الفنية:\n${extracted.technical}\n\n`;
            } else {
                answer += 'لم أجد معلومات محددة عن النقاط الفنية.\n\n';
            }
        }
        
        // إجابة شاملة
        else {
            if (extracted.authority) answer += `🏛️ **الجهة المختصة:** ${extracted.authority}\n\n`;
            if (extracted.licenses) answer += `📜 **التراخيص:** ${extracted.licenses}\n\n`;
            if (extracted.law) answer += `⚖️ **السند التشريعي:** ${extracted.law}\n\n`;
            if (extracted.location) answer += `📍 **المواقع:** ${extracted.location}\n\n`;
        }

        answer += '\n💡 *للمزيد من التفاصيل، اسأل عن جانب محدد (التراخيص، الجهات، القوانين، إلخ)*';

        return answer;
    }

    /**
     * إجابة خبير للمناطق الصناعية
     */
    async function generateIndustrialZoneExpertAnswer(query, results, extracted, intent, queryNorm) {
        let answer = '';

        // سؤال تحقق (هل هذه منطقة صناعية؟)
        if (queryNorm.includes('هل')) {
            const zone = results[0];
            if (zone && zone.score > 0.4) {
                answer += `✅ نعم، **${zone.text}** منطقة صناعية معتمدة.\n\n`;
                
                const zoneData = extractStructuredData(zone);
                if (zoneData.governorate) answer += `📍 **المحافظة:** ${zoneData.governorate}\n`;
                if (zoneData.dependency) answer += `🏛️ **جهة الولاية:** ${zoneData.dependency}\n`;
                
                return answer;
            } else {
                return `❌ لم أجد "${query}" كمنطقة صناعية معتمدة.\n\n💡 جرب البحث باسم مختلف أو اسأل "ما هي المناطق الصناعية المعتمدة؟"`;
            }
        }

        // سؤال عن منطقة محددة
        if (results.length === 1 || (results.length > 1 && results[0].score - results[1].score > 0.2)) {
            const zone = results[0];
            const zoneData = extractStructuredData(zone);
            
            answer += `### 🏭 **${zone.text}**\n\n`;
            
            if (zoneData.governorate) answer += `📍 **المحافظة:** ${zoneData.governorate}\n`;
            if (zoneData.dependency) answer += `🏛️ **جهة الولاية:** ${zoneData.dependency}\n`;
            if (zoneData.area) answer += `📐 **المساحة:** ${zoneData.area}\n`;
            if (zoneData.decision) answer += `📜 **قرار الإنشاء:** ${zoneData.decision}\n`;
            
            if (!zoneData.governorate && !zoneData.dependency && !zoneData.area) {
                answer += '\nالمعلومات التفصيلية غير متوفرة حالياً.\n';
            }
            
            return answer;
        }

        // عدة مناطق متطابقة
        answer += `### 🏭 المناطق الصناعية`;
        
        if (intent.entities?.governorates && intent.entities.governorates.length > 0) {
            answer += ` في ${intent.entities.governorates[0]}`;
        }
        
        answer += `\n\nوجدت ${results.length} منطقة:\n\n`;
        
        results.slice(0, 5).forEach((r, idx) => {
            const gov = extractSection(r.enrichedText, 'المحافظة:');
            answer += `${idx + 1}. **${r.text}**`;
            if (gov) answer += ` - ${gov}`;
            answer += '\n';
        });

        if (results.length > 5) {
            answer += `\n... و ${results.length - 5} مناطق أخرى.\n`;
        }

        answer += '\n💡 *اسأل عن منطقة محددة للحصول على تفاصيلها*';
        
        return answer;
    }

    /**
     * إجابة خبير للقرار 104
     */
    async function generateDecision104ExpertAnswer(query, result, extracted, intent, queryNorm) {
        let answer = '';

        // سؤال تحقق (هل النشاط في القرار 104؟)
        if (queryNorm.includes('هل')) {
            if (result.score > 0.4) {
                answer += `✅ نعم، **${result.text}** وارد في القرار 104.\n\n`;
                
                if (extracted.sector) {
                    const sectorInfo = extracted.sector === 'أ' ? {
                        name: 'قطاع أ',
                        desc: 'الأولوية العليا',
                        benefits: 'يحصل على أكبر حوافز وإعفاءات ضريبية ممتدة'
                    } : {
                        name: 'قطاع ب',
                        desc: 'الأولوية المتوسطة',
                        benefits: 'يحصل على حوافز وإعفاءات قياسية'
                    };
                    
                    answer += `📊 **${sectorInfo.name}** (${sectorInfo.desc})\n`;
                    answer += `💰 ${sectorInfo.benefits}\n`;
                }
                
                return answer;
            } else {
                answer += `❌ لم أجد هذا النشاط في القرار 104.\n\n`;
                answer += `💡 **للتأكد:**\n`;
                answer += `• تحقق من المصطلح الدقيق للنشاط\n`;
                answer += `• جرب استخدام كلمات بديلة\n`;
                
                return answer;
            }
        }

        // سؤال عن القطاع
        if (queryNorm.includes('قطاع') || queryNorm.includes('أولوية')) {
            answer += `### 💰 **${result.text}**\n\n`;
            
            if (extracted.sector) {
                const sectorInfo = extracted.sector === 'أ' ? {
                    name: 'قطاع أ',
                    desc: 'أولوية عليا',
                    details: 'يحظى بأكبر حوافز وإعفاءات ضريبية لمدة ممتدة، ويشمل أنشطة استراتيجية ذات أولوية للدولة'
                } : {
                    name: 'قطاع ب',
                    desc: 'أولوية متوسطة',
                    details: 'يحصل على حوافز وإعفاءات قياسية، ويشمل أنشطة مهمة للاقتصاد الوطني'
                };
                
                answer += `📊 **${sectorInfo.name}** - ${sectorInfo.desc}\n\n`;
                answer += `${sectorInfo.details}\n`;
            } else {
                answer += 'معلومات القطاع غير متوفرة.\n';
            }
            
            return answer;
        }

        // إجابة عامة عن القرار 104
        answer += `### 💰 **${result.text}**\n\n`;
        answer += `نشاط مُدرج في القرار 104.\n\n`;
        
        if (extracted.sector) {
            const sectorName = extracted.sector === 'أ' ? 'قطاع أ (الأولوية العليا)' : 'قطاع ب (الأولوية المتوسطة)';
            answer += `📊 **التصنيف:** ${sectorName}\n\n`;
            answer += `💰 هذا يعني أن النشاط يتمتع بحوافز وإعفاءات ضريبية حسب القرار.\n`;
        }
        
        return answer;
    }

    /**
     * إجابة عامة ذكية
     */
    async function generateSmartGeneralAnswer(query, results, intent) {
        let answer = '### نتائج البحث\n\n';

        // تصنيف النتائج حسب المصدر
        const bySource = {
            activities: results.filter(r => r.source === 'activities'),
            industrial: results.filter(r => r.source === 'industrial'),
            decision104: results.filter(r => r.source === 'decision104')
        };

        // عرض النتائج بشكل منظم
        if (bySource.activities.length > 0) {
            answer += `#### 📋 الأنشطة المرتبطة:\n`;
            bySource.activities.slice(0, 3).forEach((r, idx) => {
                answer += `${idx + 1}. ${r.text}\n`;
            });
            answer += '\n';
        }

        if (bySource.industrial.length > 0) {
            answer += `#### 🏭 المناطق الصناعية:\n`;
            bySource.industrial.slice(0, 3).forEach((r, idx) => {
                answer += `${idx + 1}. ${r.text}\n`;
            });
            answer += '\n';
        }

        if (bySource.decision104.length > 0) {
            answer += `#### 💰 أنشطة القرار 104:\n`;
            bySource.decision104.slice(0, 3).forEach((r, idx) => {
                answer += `${idx + 1}. ${r.text}\n`;
            });
            answer += '\n';
        }

        answer += '💡 *حدد ما تريد الاستفسار عنه بالتحديد للحصول على معلومات تفصيلية*';

        return answer;
    }

    /**
     * إجابة عند عدم وجود نتائج
     */
    function generateNoResultsExpertAnswer(query, intent) {
        let answer = '### ❌ لم أجد نتائج مطابقة\n\n';
        
        answer += '💡 **للحصول على نتائج أفضل:**\n\n';
        answer += '• جرب إعادة صياغة السؤال بكلمات مختلفة\n';
        answer += '• استخدم المصطلحات الرسمية للنشاط\n';
        answer += '• تأكد من الكتابة الصحيحة\n\n';
        
        answer += '**أمثلة على أسئلة يمكنني مساعدتك بها:**\n\n';
        answer += '• "ما هي شروط ترخيص نشاط تصنيع الملابس؟"\n';
        answer += '• "المناطق الصناعية في القاهرة"\n';
        answer += '• "هل صناعة الأدوية في القرار 104؟"';
        
        return answer;
    }

    /**
     * إجابة للتوضيح عند وجود نتائج متقاربة
     */
    function generateClarificationAnswer(query, results, intent) {
        let answer = '### 🤔 وجدت عدة نتائج متقاربة\n\n';
        answer += 'أيها تقصد؟\n\n';
        
        results.slice(0, 4).forEach((r, idx) => {
            const sourceIcon = r.source === 'activities' ? '📋' : 
                             r.source === 'industrial' ? '🏭' : '💰';
            const confidence = (r.score * 100).toFixed(1);
            answer += `${idx + 1}. ${sourceIcon} ${r.text} (${confidence}%)\n`;
        });
        
        answer += '\n💡 *حدد رقم النتيجة أو أعد صياغة السؤال بمزيد من التفاصيل*';
        
        return answer;
    }

    /**
     * دالة متوافقة مع الواجهة القديمة
     */
    async function answer(query, history = []) {
        const result = await processQuery(query);
        
        return {
            answer: result.answer,
            intent: result.intent,
            entities: result.entities,
            confidence: result.results?.[0]?.score || result.confidence || 0,
            hasAmbiguity: result.hasAmbiguity,
            sources: result.results || []
        };
    }

    /**
     * الواجهة العامة للنظام
     */
    return {
        processQuery: processQuery,
        answer: answer,
        clearContext: () => {
            conversationContext = {
                lastQuery: null,
                lastIntent: null,
                lastResults: null,
                lastEntities: null,
                history: []
            };
        },
        getContext: () => conversationContext
    };
})();
