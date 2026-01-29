/**
 * Expert Assistant Core v 4 - المستشار الخبير الذكي
 * نظام ذكي يجيب على الأسئلة بدقة واحترافية كخبير حقيقي
 */

const ExpertAssistant = (() => {
    
    // إعدادات الذكاء المتقدم
    const CONFIG = {
        SIMILARITY_THRESHOLD: 0.15,
        AMBIGUITY_THRESHOLD: 0.08,
        MIN_CONFIDENCE_CLEAR: 0.65,
        MIN_CONFIDENCE_MEDIUM: 0.45,
        MAX_SIMILAR_RESULTS: 4,
        CONTEXT_WEIGHT: 0.25,
        ENTITY_MATCH_BONUS: 0.15,
        EXACT_MATCH_MULTIPLIER: 1.5
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
     * البحث المتقدم مع تحليل دلالي
     */
    async function searchVectors(query, dataType = 'all', intent = null, context = null) {
        const allData = DataLoader.getAllData();
        let results = [];

        const queryNorm = IntentEngine.normalizeArabic(query);
        const queryWords = extractSignificantWords(queryNorm);
        const queryPhrases = extractPhrases(queryNorm);

        console.log(`🔍 Searching: "${query}"`);
        console.log(`📊 Keywords: ${queryWords.length}, Phrases: ${queryPhrases.length}`);

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

        results = advancedRanking(results, intent, context);
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
     * استخراج الكلمات المهمة
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
            .map(w => w.trim());
    }

    /**
     * استخراج العبارات المهمة
     */
    function extractPhrases(text) {
        const phrases = [];
        const words = text.split(/\s+/);
        
        for (let i = 0; i < words.length - 1; i++) {
            phrases.push(words[i] + ' ' + words[i + 1]);
            if (i < words.length - 2) {
                phrases.push(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
            }
        }
        
        return phrases;
    }

    /**
     * اختيار قواعد البيانات المناسبة
     */
    function selectDatasets(dataType, intent, allData) {
        if (dataType !== 'all') {
            return [{ name: dataType, data: allData[dataType] }];
        }

        const intentName = intent?.primary?.name || '';
        
        if (intentName.includes('DECISION104')) {
            return [
                { name: 'decision104', data: allData.decision104, priority: 3 },
                { name: 'activities', data: allData.activities, priority: 1 }
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
                { name: 'decision104', data: allData.decision104, priority: 1 }
            ];
        }

        return [
            { name: 'activities', data: allData.activities, priority: 2 },
            { name: 'industrial', data: allData.industrial, priority: 2 },
            { name: 'decision104', data: allData.decision104, priority: 2 }
        ];
    }

    /**
     * حساب درجة الصلة
     */
    function calculateRelevanceScore(item, queryWords, queryPhrases, queryNorm, intent, context) {
        const textNorm = IntentEngine.normalizeArabic(item.text);
        const enrichedNorm = IntentEngine.normalizeArabic(item.enriched_text || '');
        
        let score = 0;
        let breakdown = {
            exactMatch: 0,
            wordMatch: 0,
            phraseMatch: 0,
            semanticMatch: 0,
            entityMatch: 0
        };
        let matchedWords = [];
        let matchedPhrases = [];

        // تطابق تام
        if (textNorm === queryNorm || textNorm.includes(queryNorm) || queryNorm.includes(textNorm)) {
            breakdown.exactMatch = 1.0;
            score += 1.0 * CONFIG.EXACT_MATCH_MULTIPLIER;
        }

        // تطابق الكلمات
        queryWords.forEach(word => {
            if (textNorm.includes(word) || enrichedNorm.includes(word)) {
                breakdown.wordMatch += 0.15;
                matchedWords.push(word);
            }
        });
        score += Math.min(breakdown.wordMatch, 0.6);

        // تطابق العبارات
        queryPhrases.forEach(phrase => {
            if (textNorm.includes(phrase) || enrichedNorm.includes(phrase)) {
                breakdown.phraseMatch += 0.2;
                matchedPhrases.push(phrase);
            }
        });
        score += Math.min(breakdown.phraseMatch, 0.4);

        // مكافأة تطابق الكيانات
        if (intent?.entities) {
            Object.values(intent.entities).flat().forEach(entity => {
                const entityNorm = IntentEngine.normalizeArabic(entity);
                if (textNorm.includes(entityNorm)) {
                    breakdown.entityMatch += CONFIG.ENTITY_MATCH_BONUS;
                }
            });
            score += breakdown.entityMatch;
        }

        return {
            total: Math.min(score, 1.0),
            breakdown: breakdown,
            details: {
                matchedWords: matchedWords,
                matchedPhrases: matchedPhrases
            }
        };
    }

    /**
     * ترتيب متقدم للنتائج
     */
    function advancedRanking(results, intent, context) {
        return results.sort((a, b) => {
            let scoreA = a.score;
            let scoreB = b.score;

            // أولوية حسب المصدر
            const intentName = intent?.primary?.name || '';
            if (intentName.includes('DECISION104')) {
                if (a.source === 'decision104') scoreA *= 1.3;
                if (b.source === 'decision104') scoreB *= 1.3;
            }
            if (intentName.includes('INDUSTRIAL')) {
                if (a.source === 'industrial') scoreA *= 1.3;
                if (b.source === 'industrial') scoreB *= 1.3;
            }
            if (intentName.includes('ACTIVITY')) {
                if (a.source === 'activities') scoreA *= 1.3;
                if (b.source === 'activities') scoreB *= 1.3;
            }

            return scoreB - scoreA;
        });
    }

    /**
     * تحليل التشابه بين النتائج
     */
    function analyzeResultsSimilarity(results) {
        if (results.length === 0) {
            return { hasAmbiguity: false, groups: [], topConfidence: 0 };
        }

        const topScore = results[0].score;
        const similarResults = results.filter(r => 
            Math.abs(r.score - topScore) < CONFIG.AMBIGUITY_THRESHOLD
        );

        return {
            hasAmbiguity: similarResults.length > 1,
            groups: [similarResults],
            topConfidence: topScore
        };
    }

    /**
     * استخراج قسم من النص المخصب
     */
    function extractSection(enrichedText, sectionName) {
        if (!enrichedText) return null;
        
        const regex = new RegExp(`${sectionName}\\s*([^\\n]+)`, 'i');
        const match = enrichedText.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * استخراج كل المعلومات من النص المخصب
     */
    function extractAllInfo(result) {
        const enriched = result.enrichedText || '';
        
        return {
            licenses: extractSection(enriched, 'التراخيص والشروط:'),
            authority: extractSection(enriched, 'الجهة المختصة:'),
            law: extractSection(enriched, 'السند التشريعي:'),
            guide: extractSection(enriched, 'الدليل الإرشادي:'),
            location: extractSection(enriched, 'الموقع الملائم:'),
            technical: extractSection(enriched, 'النقاط الفنية للمعاينة:'),
            description: extractSection(enriched, 'توصيف الإجراءات:'),
            governorate: extractSection(enriched, 'المحافظة:'),
            dependency: extractSection(enriched, 'التبعية:'),
            area: extractSection(enriched, 'المساحة:'),
            decision: extractSection(enriched, 'قرار الإنشاء:'),
            sector: extractSection(enriched, 'القطاع:')
        };
    }

    /**
     * الدالة الرئيسية للمعالجة - هنا السحر يحدث! 🎯
     */
    async function processQuery(query) {
        console.log('\n🎯 ===== معالجة جديدة =====');
        console.log(`📝 السؤال: "${query}"`);

        // تحليل النية والكيانات
        const intent = await IntentEngine.detectIntent(query, conversationContext);
        
        console.log(`🧠 النية: ${intent.primary.name} (${(intent.primary.confidence * 100).toFixed(0)}%)`);
        if (intent.entities && Object.keys(intent.entities).length > 0) {
            console.log(`🏷️ الكيانات:`, intent.entities);
        }

        // البحث عن النتائج
        const searchResult = await searchVectors(query, 'all', intent, conversationContext);
        
        // حفظ السياق للأسئلة التالية
        conversationContext.lastQuery = query;
        conversationContext.lastIntent = intent;
        conversationContext.lastResults = searchResult.results;
        conversationContext.lastEntities = intent.entities;
        conversationContext.history.push({ query, intent, results: searchResult.results });
        if (conversationContext.history.length > 5) {
            conversationContext.history.shift();
        }

        // توليد الإجابة الذكية
        const answer = await generateExpertAnswer(query, searchResult, intent);
        
        console.log(`✅ الإجابة جاهزة (${answer.length} حرف)`);
        console.log('🎯 ===== انتهى =====\n');

        return answer;
    }

    /**
     * توليد إجابة خبير ذكية ومباشرة - القلب النابض للنظام! 💡
     */
    async function generateExpertAnswer(query, searchResult, intent) {
        const { results, hasAmbiguity, confidence } = searchResult;
        const intentName = intent?.primary?.name || 'GENERAL';
        const queryNorm = IntentEngine.normalizeArabic(query);

        // حالة عدم وجود نتائج
        if (results.length === 0) {
            return generateNoResultsExpertAnswer(query, intent);
        }

        // حالة الغموض - نتائج متقاربة جداً
        if (hasAmbiguity && confidence < CONFIG.MIN_CONFIDENCE_CLEAR) {
            return generateClarificationAnswer(query, results, intent);
        }

        // الإجابة الرئيسية بناءً على نوع السؤال
        const topResult = results[0];
        const extracted = extractAllInfo(topResult);

        // 🎯 التعامل مع أسئلة الأنشطة
        if (intentName.startsWith('ACTIVITY')) {
            return await generateActivityExpertAnswer(query, topResult, extracted, intent, queryNorm);
        }
        
        // 🏭 التعامل مع المناطق الصناعية
        if (intentName.startsWith('INDUSTRIAL')) {
            return await generateIndustrialExpertAnswer(query, results, extracted, intent, queryNorm);
        }
        
        // 💰 التعامل مع القرار 104
        if (intentName.startsWith('DECISION104')) {
            return await generateDecision104ExpertAnswer(query, topResult, extracted, intent, queryNorm);
        }

        // إجابة عامة ذكية
        return await generateSmartGeneralAnswer(query, results, intent);
    }

    /**
     * إجابة خبير للأنشطة - مباشرة ومفيدة
     */
    async function generateActivityExpertAnswer(query, result, extracted, intent, queryNorm) {
        const intentName = intent?.primary?.name || '';
        let answer = '';

        // 📋 سؤال عن التراخيص والإجراءات
        if (intentName.includes('LICENSE') || queryNorm.includes('ترخيص') || queryNorm.includes('اجراء') || queryNorm.includes('متطلب')) {
            answer += `بالنسبة لنشاط **${result.text}**:\n\n`;
            
            if (extracted.licenses) {
                answer += `📋 **الإجراءات والمتطلبات:**\n${extracted.licenses}\n\n`;
            } else {
                answer += '📋 المعلومات التفصيلية عن الإجراءات غير متوفرة حالياً في قاعدة البيانات.\n\n';
            }
            
            if (extracted.authority) {
                answer += `🏛️ **الجهة المختصة:** ${extracted.authority}\n\n`;
            }
            
            if (extracted.law) {
                answer += `⚖️ **السند القانوني:** ${extracted.law}\n`;
            }
            
            return answer;
        }

        // 🏛️ سؤال عن الجهة المختصة
        if (intentName.includes('AUTHORITY') || queryNorm.includes('جهة') || queryNorm.includes('مسؤول')) {
            answer += `الجهة المختصة بنشاط **${result.text}**:\n\n`;
            
            if (extracted.authority) {
                answer += `🏛️ ${extracted.authority}\n\n`;
            } else {
                answer += 'الجهة المختصة غير محددة في قاعدة البيانات. يُنصح بالتواصل مع الهيئة العامة للاستثمار.\n\n';
            }
            
            return answer;
        }

        // ⚖️ سؤال عن القوانين
        if (intentName.includes('LAW') || queryNorm.includes('قانون') || queryNorm.includes('قرار') || queryNorm.includes('لائحة')) {
            answer += `الإطار القانوني لنشاط **${result.text}**:\n\n`;
            
            if (extracted.law) {
                answer += `⚖️ ${extracted.law}\n\n`;
            } else {
                answer += 'السند التشريعي غير محدد في قاعدة البيانات.\n\n';
            }
            
            return answer;
        }

        // 🔧 سؤال عن النقاط الفنية
        if (intentName.includes('TECHNICAL') || queryNorm.includes('فني') || queryNorm.includes('معاينة') || queryNorm.includes('اشتراطات')) {
            answer += `النقاط الفنية لنشاط **${result.text}**:\n\n`;
            
            if (extracted.technical) {
                answer += `🔧 ${extracted.technical}\n\n`;
            } else {
                answer += 'النقاط الفنية غير متوفرة في قاعدة البيانات.\n\n';
            }
            
            return answer;
        }

        // 📍 سؤال عن الموقع
        if (intentName.includes('LOCATION') || queryNorm.includes('موقع') || queryNorm.includes('مكان') || queryNorm.includes('منطقة')) {
            answer += `بخصوص موقع نشاط **${result.text}**:\n\n`;
            
            if (extracted.location) {
                answer += `📍 ${extracted.location}\n\n`;
            } else {
                answer += 'معلومات الموقع الملائم غير متوفرة.\n\n';
            }
            
            return answer;
        }

        // 📖 سؤال عن الدليل الإرشادي
        if (intentName.includes('GUIDE') || queryNorm.includes('دليل') || queryNorm.includes('ارشادي')) {
            answer += `الدليل الإرشادي لنشاط **${result.text}**:\n\n`;
            
            if (extracted.guide) {
                answer += `📖 ${extracted.guide}\n\n`;
            } else {
                answer += 'الدليل الإرشادي غير متوفر.\n\n';
            }
            
            return answer;
        }

        // إجابة شاملة عامة إذا لم يكن السؤال محدداً
        answer += `معلومات عن نشاط **${result.text}**:\n\n`;
        
        if (extracted.authority) {
            answer += `🏛️ **الجهة المختصة:** ${extracted.authority}\n\n`;
        }
        
        if (extracted.licenses) {
            const shortLicenses = extracted.licenses.length > 400 
                ? extracted.licenses.substring(0, 400) + '...' 
                : extracted.licenses;
            answer += `📋 **الإجراءات:** ${shortLicenses}\n\n`;
        }
        
        if (extracted.law) {
            answer += `⚖️ **السند القانوني:** ${extracted.law}\n\n`;
        }

        // اقتراحات للحصول على معلومات إضافية
        answer += '💡 يمكنني تزويدك بمعلومات تفصيلية عن:\n';
        const suggestions = [];
        if (extracted.licenses) suggestions.push('الإجراءات والمتطلبات الكاملة');
        if (extracted.technical) suggestions.push('النقاط الفنية للمعاينة');
        if (extracted.location) suggestions.push('الأماكن المناسبة للنشاط');
        if (extracted.guide) suggestions.push('الدليل الإرشادي');
        
        suggestions.forEach(s => answer += `• ${s}\n`);
        
        return answer;
    }

    /**
     * إجابة خبير للمناطق الصناعية
     */
    async function generateIndustrialExpertAnswer(query, results, extracted, intent, queryNorm) {
        let answer = '';

        // 🔢 سؤال عن العدد
        if (queryNorm.includes('كم عدد') || queryNorm.includes('عدد المناطق')) {
            const count = results.length;
            
            if (intent.entities?.governorates && intent.entities.governorates.length > 0) {
                const gov = intent.entities.governorates[0];
                answer += `يوجد **${count} منطقة صناعية** في محافظة ${gov}:\n\n`;
            } else {
                answer += `إجمالي المناطق الصناعية في مصر: **${count} منطقة**\n\n`;
            }

            // عرض قائمة مختصرة
            const displayCount = Math.min(count, 10);
            results.slice(0, displayCount).forEach((r, idx) => {
                const gov = extractSection(r.enrichedText, 'المحافظة:');
                answer += `${idx + 1}. ${r.text}`;
                if (gov) answer += ` - ${gov}`;
                answer += '\n';
            });

            if (count > displayCount) {
                answer += `\n... وهناك ${count - displayCount} منطقة أخرى.\n`;
            }

            answer += '\n💡 اسأل عن أي منطقة للحصول على تفاصيلها الكاملة.';
            
            return answer;
        }

        // ✅ سؤال تحقق من منطقة (هل ... منطقة صناعية؟)
        if (queryNorm.includes('هل') && (queryNorm.includes('منطقة صناعي') || queryNorm.includes('صناعي'))) {
            const zone = results[0];
            
            if (zone.score > 0.5) {
                answer += `✅ نعم، **${zone.text}** هي منطقة صناعية معتمدة.\n\n`;
                
                if (extracted.governorate) answer += `📍 **المحافظة:** ${extracted.governorate}\n`;
                if (extracted.dependency) answer += `🏛️ **جهة الولاية:** ${extracted.dependency}\n`;
                if (extracted.area) answer += `📐 **المساحة:** ${extracted.area}\n`;
                if (extracted.decision) answer += `📜 **قرار الإنشاء:** ${extracted.decision}\n`;
                
                return answer;
            } else {
                answer += `❌ لم أجد "${query}" كمنطقة صناعية معتمدة في قاعدة البيانات.\n\n`;
                answer += `💡 تأكد من:\n`;
                answer += `• الاسم الدقيق للمنطقة\n`;
                answer += `• استخدام المصطلح الرسمي\n`;
                
                if (results.length > 0) {
                    answer += `\n**هل تقصد إحدى هذه المناطق؟**\n`;
                    results.slice(0, 3).forEach((r, idx) => {
                        answer += `${idx + 1}. ${r.text}\n`;
                    });
                }
                
                return answer;
            }
        }

        // تفاصيل منطقة محددة
        if (results.length === 1 || results[0].score > 0.7) {
            const zone = results[0];
            
            answer += `معلومات عن **${zone.text}**:\n\n`;
            
            if (extracted.governorate) answer += `📍 **المحافظة:** ${extracted.governorate}\n`;
            if (extracted.dependency) answer += `🏛️ **جهة الولاية:** ${extracted.dependency}\n`;
            if (extracted.area) answer += `📐 **المساحة:** ${extracted.area}\n`;
            if (extracted.decision) answer += `📜 **قرار الإنشاء:** ${extracted.decision}\n`;
            
            if (!extracted.governorate && !extracted.dependency && !extracted.area) {
                answer += '\nالمعلومات التفصيلية غير متوفرة حالياً.\n';
            }
            
            return answer;
        }

        // عدة مناطق متطابقة
        answer += `وجدت ${results.length} منطقة صناعية`;
        
        if (intent.entities?.governorates && intent.entities.governorates.length > 0) {
            answer += ` في ${intent.entities.governorates[0]}`;
        }
        
        answer += `:\n\n`;
        
        results.slice(0, 5).forEach((r, idx) => {
            const gov = extractSection(r.enrichedText, 'المحافظة:');
            answer += `${idx + 1}. **${r.text}**`;
            if (gov) answer += ` - ${gov}`;
            answer += '\n';
        });

        if (results.length > 5) {
            answer += `\n... و ${results.length - 5} مناطق أخرى.\n`;
        }

        answer += '\n💡 اسأل عن منطقة محددة للحصول على تفاصيلها.';
        
        return answer;
    }

    /**
     * إجابة خبير للقرار 104
     */
    async function generateDecision104ExpertAnswer(query, result, extracted, intent, queryNorm) {
        let answer = '';

        // سؤال تحقق (هل النشاط في القرار 104؟)
        if (queryNorm.includes('هل')) {
            if (result.score > 0.5) {
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
                answer += `💡 تأكد من:\n`;
                answer += `• المصطلح الدقيق للنشاط\n`;
                answer += `• استخدام كلمات بديلة أو مرادفات\n`;
                
                return answer;
            }
        }

        // سؤال عن القطاع
        if (queryNorm.includes('قطاع') || queryNorm.includes('أولوية')) {
            answer += `نشاط **${result.text}**:\n\n`;
            
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
        answer += `نشاط **${result.text}** مُدرج في القرار 104.\n\n`;
        
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
        let answer = '';

        // تصنيف النتائج حسب المصدر
        const bySource = {
            activities: results.filter(r => r.source === 'activities'),
            industrial: results.filter(r => r.source === 'industrial'),
            decision104: results.filter(r => r.source === 'decision104')
        };

        // عرض النتائج بشكل منظم
        if (bySource.activities.length > 0) {
            answer += `📋 **الأنشطة المرتبطة:**\n`;
            bySource.activities.slice(0, 3).forEach((r, idx) => {
                answer += `${idx + 1}. ${r.text}\n`;
            });
            answer += '\n';
        }

        if (bySource.industrial.length > 0) {
            answer += `🏭 **المناطق الصناعية:**\n`;
            bySource.industrial.slice(0, 3).forEach((r, idx) => {
                answer += `${idx + 1}. ${r.text}\n`;
            });
            answer += '\n';
        }

        if (bySource.decision104.length > 0) {
            answer += `💰 **أنشطة القرار 104:**\n`;
            bySource.decision104.slice(0, 3).forEach((r, idx) => {
                answer += `${idx + 1}. ${r.text}\n`;
            });
            answer += '\n';
        }

        answer += '💡 حدد ما تريد الاستفسار عنه بالتحديد للحصول على معلومات تفصيلية.';

        return answer;
    }

    /**
     * إجابة عند عدم وجود نتائج - بأسلوب خبير مساعد
     */
    function generateNoResultsExpertAnswer(query, intent) {
        let answer = 'عذراً، لم أجد معلومات مطابقة في قاعدة البيانات.\n\n';
        
        answer += '💡 **للحصول على نتائج أفضل:**\n';
        answer += '• جرب إعادة صياغة السؤال بكلمات مختلفة\n';
        answer += '• استخدم المصطلحات الرسمية للنشاط\n';
        answer += '• تأكد من الكتابة الصحيحة\n\n';
        
        answer += '**أمثلة على أسئلة يمكنني مساعدتك بها:**\n';
        answer += '• "ما هي شروط ترخيص نشاط تصنيع الملابس؟"\n';
        answer += '• "المناطق الصناعية في القاهرة"\n';
        answer += '• "هل صناعة الأدوية في القرار 104؟"';
        
        return answer;
    }

    /**
     * إجابة للتوضيح عند وجود نتائج متقاربة
     */
    function generateClarificationAnswer(query, results, intent) {
        let answer = 'وجدت عدة نتائج متقاربة، أيها تقصد؟\n\n';
        
        results.slice(0, 4).forEach((r, idx) => {
            const sourceIcon = r.source === 'activities' ? '📋' : 
                             r.source === 'industrial' ? '🏭' : '💰';
            answer += `${idx + 1}. ${sourceIcon} ${r.text}\n`;
        });
        
        answer += '\n💡 حدد رقم النتيجة أو أعد صياغة السؤال بمزيد من التفاصيل.';
        
        return answer;
    }

    /**
     * دالة متوافقة مع الواجهة القديمة
     */
    async function answer(query, history = []) {
        // معالجة السؤال
        const answerText = await processQuery(query);
        
        // إرجاع بنفس التنسيق المتوقع من الواجهة
        return {
            answer: answerText,
            intent: conversationContext.lastIntent,
            entities: conversationContext.lastEntities,
            confidence: conversationContext.lastResults?.[0]?.score || 0,
            hasAmbiguity: false, // يمكن تحسينها لاحقاً
            sources: conversationContext.lastResults?.slice(0, 3) || []
        };
    }

    /**
     * الواجهة العامة للنظام
     */
    return {
        processQuery: processQuery,
        answer: answer, // الدالة المتوافقة
        clearContext: () => {
            conversationContext = {
                lastQuery: null,
                lastIntent: null,
                lastResults: null,
                lastEntities: null,
                history: []
            };
        }
    };
})();

