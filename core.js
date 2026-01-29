/**
 * Expert Assistant Core - Simple Version
 * بحث نصي محسّن بدون نماذج AI ثقيلة - سريع وفعال
 */

const ExpertAssistant = (() => {
    
    /**
     * البحث المتقدم بالكلمات المفتاحية
     */
    async function searchVectors(query, dataType = 'all', topK = 10, threshold = 0.25) {
        const allData = DataLoader.getAllData();
        let results = [];

        // تطبيع الاستعلام
        const queryNorm = IntentEngine.normalizeArabic(query);
        const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 2);

        console.log(`🔍 Searching for: "${query}" (${queryWords.length} keywords)`);

        // تحديد قواعد البيانات المستهدفة
        const datasetsToSearch = [];
        if (dataType === 'all' || dataType === 'activities') {
            datasetsToSearch.push({ name: 'activities', data: allData.activities });
        }
        if (dataType === 'all' || dataType === 'decision104') {
            datasetsToSearch.push({ name: 'decision104', data: allData.decision104 });
        }
        if (dataType === 'all' || dataType === 'industrial') {
            datasetsToSearch.push({ name: 'industrial', data: allData.industrial });
        }

        // البحث في كل قاعدة بيانات
        datasetsToSearch.forEach(dataset => {
            if (!dataset.data || dataset.data.length === 0) {
                console.warn(`Dataset ${dataset.name} is empty or missing`);
                return;
            }

            console.log(`Searching in ${dataset.name}: ${dataset.data.length} items`);

            dataset.data.forEach(item => {
                const textNorm = IntentEngine.normalizeArabic(item.text);
                const enrichedNorm = IntentEngine.normalizeArabic(item.enriched_text || '');
                
                let matchScore = 0;
                let matchedWords = 0;
                let exactMatches = 0;

                queryWords.forEach(word => {
                    // تطابق تام في النص الرئيسي (أعلى أولوية)
                    if (textNorm.includes(word)) {
                        matchScore += 5;
                        matchedWords++;
                        exactMatches++;
                    }
                    // تطابق جزئي في النص الرئيسي
                    else if (textNorm.split(/\s+/).some(w => w.includes(word) || word.includes(w))) {
                        matchScore += 3;
                        matchedWords++;
                    }
                    // تطابق تام في النص المعزز
                    else if (enrichedNorm.includes(word)) {
                        matchScore += 2;
                        matchedWords++;
                    }
                    // تطابق جزئي في النص المعزز
                    else if (enrichedNorm.split(/\s+/).some(w => w.includes(word) || word.includes(w))) {
                        matchScore += 1;
                        matchedWords++;
                    }
                });

                // حساب النتيجة النهائية
                const coverage = queryWords.length > 0 ? matchedWords / queryWords.length : 0;
                const avgScore = queryWords.length > 0 ? matchScore / (queryWords.length * 5) : 0;
                
                // وزن التغطية 60% والنتيجة المتوسطة 40%
                let finalScore = (coverage * 0.6) + (avgScore * 0.4);
                
                // مكافأة للتطابقات التامة
                if (exactMatches > 0) {
                    finalScore += (exactMatches / queryWords.length) * 0.1;
                }

                if (finalScore >= threshold) {
                    results.push({
                        id: item.id,
                        text: item.text,
                        enrichedText: item.enriched_text,
                        score: Math.min(1.0, finalScore),
                        source: dataset.name,
                        rawData: item,
                        matchedWords,
                        coverage: coverage * 100,
                        exactMatches
                    });
                }
            });
        });

        // ترتيب النتائج
        results.sort((a, b) => {
            // أولوية للتطابقات التامة
            if (a.exactMatches !== b.exactMatches) {
                return b.exactMatches - a.exactMatches;
            }
            // ثم النتيجة الإجمالية
            return b.score - a.score;
        });
        
        console.log(`✅ Found ${results.length} results, returning top ${topK}`);
        if (results.length > 0) {
            console.log(`Top result: "${results[0].text}" (Score: ${(results[0].score * 100).toFixed(0)}%, Coverage: ${results[0].coverage.toFixed(0)}%)`);
        }
        
        return results.slice(0, topK);
    }

    /**
     * إعادة ترتيب النتائج حسب النية والسياق
     */
    function rerankResults(results, intent, context) {
        if (!intent || results.length === 0) return results;

        return results.map(result => {
            let bonus = 0;

            // مكافأة حسب نوع المصدر
            if (intent.primary.name.startsWith('INDUSTRIAL_ZONE') && result.source === 'industrial') {
                bonus += 0.2;
            } else if (intent.primary.name.startsWith('DECISION104') && result.source === 'decision104') {
                bonus += 0.2;
            } else if (intent.primary.name.startsWith('ACTIVITY') && result.source === 'activities') {
                bonus += 0.2;
            }

            // مكافأة لتطابق الكيانات
            if (context && context.entities) {
                Object.values(context.entities).flat().forEach(entity => {
                    if (result.enrichedText && 
                        IntentEngine.normalizeArabic(result.enrichedText).includes(
                            IntentEngine.normalizeArabic(entity)
                        )) {
                        bonus += 0.05;
                    }
                });
            }

            return {
                ...result,
                score: Math.min(1.0, result.score + bonus),
                reranked: true
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * استخراج المعلومات من النتائج
     */
    function extractInformation(results, intent) {
        if (results.length === 0) return null;

        const extracted = {};
        const intentName = intent.primary.name;

        results.forEach(result => {
            // معالجة الأنشطة
            if (result.source === 'activities' && result.rawData) {
                const enriched = result.rawData.enriched_text || '';
                
                if (intentName === 'ACTIVITY_LICENSE' || intentName.includes('LICENSE')) {
                    extracted.licenses = extractSection(enriched, 'المتطلبات:');
                }
                if (intentName === 'ACTIVITY_AUTHORITY' || intentName.includes('AUTHORITY')) {
                    extracted.authority = extractSection(enriched, 'الجهة:');
                }
                if (intentName === 'ACTIVITY_LAW' || intentName.includes('LAW')) {
                    extracted.law = extractSection(enriched, 'القانون:');
                }
                if (intentName === 'ACTIVITY_GUIDE' || intentName.includes('GUIDE')) {
                    extracted.guide = extractSection(enriched, 'الدليل:');
                }
                if (intentName === 'ACTIVITY_LOCATION' || intentName.includes('LOCATION')) {
                    extracted.location = extractSection(enriched, 'الموقع:');
                }
                if (intentName === 'ACTIVITY_TECHNICAL' || intentName.includes('TECHNICAL')) {
                    extracted.technical = extractSection(enriched, 'ملاحظات فنية:');
                }
                if (intentName === 'ACTIVITY_DESCRIPTION' || intentName.includes('DESCRIPTION')) {
                    extracted.description = extractSection(enriched, 'الإجراءات:');
                }
                
                // معلومات عامة دائماً
                if (!extracted.licenses) extracted.licenses = extractSection(enriched, 'المتطلبات:');
                if (!extracted.authority) extracted.authority = extractSection(enriched, 'الجهة:');
            }

            // معالجة المناطق الصناعية
            if (result.source === 'industrial' && result.rawData) {
                const enriched = result.enrichedText || '';
                
                extracted.zone = result.text;
                extracted.governorate = extractField(enriched, 'المحافظة:');
                extracted.dependency = extractField(enriched, 'التبعية:');
                extracted.area = extractField(enriched, 'المساحة:');
                extracted.decision = extractField(enriched, 'القرار:');
                extracted.location = extractField(enriched, 'موقع:');
            }

            // معالجة القرار 104
            if (result.source === 'decision104' && result.rawData) {
                extracted.decision104 = result.text;
                const enriched = result.enrichedText || '';
                
                const sectorMatch = enriched.match(/قطاع\s+([أب])/);
                if (sectorMatch) {
                    extracted.sector = sectorMatch[1];
                }
            }
        });

        return Object.keys(extracted).length > 0 ? extracted : null;
    }

    /**
     * استخراج قسم من النص المعزز
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
     * استخراج حقل من النص المعزز
     */
    function extractField(text, marker) {
        const regex = new RegExp(marker + '\\s*([^|]+)', 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * توليد الإجابة
     */
    function generateAnswer(query, results, intent, extracted) {
        if (results.length === 0) {
            return 'عذراً، لم أتمكن من العثور على معلومات دقيقة. يمكنك:\n• إعادة صياغة السؤال\n• استخدام كلمات مفتاحية مختلفة\n• تجربة الأسئلة السريعة في الأسفل';
        }

        const intentName = intent.primary.name;
        let answer = '';

        if (intentName.startsWith('ACTIVITY')) {
            answer = generateActivityAnswer(query, results, intent, extracted);
        } else if (intentName.startsWith('INDUSTRIAL_ZONE')) {
            answer = generateIndustrialAnswer(query, results, intent, extracted);
        } else if (intentName.startsWith('DECISION104')) {
            answer = generateDecision104Answer(query, results, intent, extracted);
        } else {
            answer = generateGeneralAnswer(query, results);
        }

        return answer;
    }

    /**
     * إجابة خاصة بالأنشطة
     */
    function generateActivityAnswer(query, results, intent, extracted) {
        const intentName = intent.primary.name;
        const topResult = results[0];
        const activityName = topResult.text;

        let answer = `**${activityName}**\n\n`;

        if (intentName === 'ACTIVITY_LICENSE' && extracted && extracted.licenses) {
            answer += `📋 **التراخيص المطلوبة:**\n${extracted.licenses}`;
        } 
        else if (intentName === 'ACTIVITY_AUTHORITY' && extracted && extracted.authority) {
            answer += `🏛️ **الجهات المختصة:**\n${extracted.authority}`;
        }
        else if (intentName === 'ACTIVITY_LAW' && extracted && extracted.law) {
            answer += `⚖️ **السند التشريعي:**\n${extracted.law}`;
        }
        else if (intentName === 'ACTIVITY_GUIDE' && extracted && extracted.guide) {
            answer += `📖 **الدليل الإرشادي:**\n${extracted.guide}`;
        }
        else if (intentName === 'ACTIVITY_LOCATION' && extracted && extracted.location) {
            answer += `📍 **الموقع الملائم:**\n${extracted.location}`;
        }
        else if (intentName === 'ACTIVITY_TECHNICAL' && extracted && extracted.technical) {
            const tech = extracted.technical;
            answer += `🔧 **النقاط الفنية للمعاينة:**\n${tech.substring(0, 1200)}`;
            if (tech.length > 1200) {
                answer += '\n\n💡 *للحصول على المزيد من التفاصيل، اسأل عن نقطة محددة*';
            }
        }
        else if (intentName === 'ACTIVITY_DESCRIPTION' && extracted && extracted.description) {
            answer += `📝 **توصيف النشاط:**\n${extracted.description}`;
        }
        else {
            // إجابة عامة مع كل المعلومات المتاحة
            if (extracted) {
                if (extracted.licenses) {
                    answer += `📋 **التراخيص:**\n${extracted.licenses}\n\n`;
                }
                if (extracted.authority) {
                    answer += `🏛️ **الجهات:**\n${extracted.authority}\n\n`;
                }
            }
            
            answer += '💡 *يمكنني مساعدتك في معرفة المزيد عن:*\n';
            answer += '• التراخيص والمتطلبات\n';
            answer += '• الجهات المختصة\n';
            answer += '• القوانين واللوائح\n';
            answer += '• النقاط الفنية للمعاينة';
        }

        return answer;
    }

    /**
     * إجابة خاصة بالمناطق الصناعية
     */
    function generateIndustrialAnswer(query, results, intent, extracted) {
        const intentName = intent.primary.name;

        if (results.length === 1 && extracted) {
            const zone = extracted.zone || results[0].text;
            let answer = `**${zone}**\n\n`;

            if (intentName === 'INDUSTRIAL_ZONE_AUTHORITY') {
                answer += `🏛️ **جهة الولاية:** ${extracted.dependency || 'غير محدد'}`;
            }
            else if (intentName === 'INDUSTRIAL_ZONE_DECISION') {
                answer += `📜 **قرار الإنشاء:**\n${extracted.decision || 'غير محدد'}`;
            }
            else if (intentName === 'INDUSTRIAL_ZONE_AREA') {
                answer += `📐 **المساحة:** ${extracted.area || 'غير محدد'}`;
            }
            else if (intentName === 'INDUSTRIAL_ZONE_CHECK') {
                answer += `✅ نعم، هذه منطقة صناعية معتمدة\n\n`;
                answer += `📍 **المحافظة:** ${extracted.governorate || 'غير محدد'}\n`;
                answer += `🏛️ **التبعية:** ${extracted.dependency || 'غير محدد'}`;
            }
            else {
                answer += `📍 **المحافظة:** ${extracted.governorate || 'غير محدد'}\n`;
                answer += `🏛️ **التبعية:** ${extracted.dependency || 'غير محدد'}\n`;
                answer += `📐 **المساحة:** ${extracted.area || 'غير محدد'}\n`;
                answer += `📜 **القرار:** ${extracted.decision || 'غير محدد'}`;
            }

            return answer;
        } else {
            let answer = `وجدت **${results.length}** منطقة صناعية:\n\n`;
            results.slice(0, 10).forEach((result, idx) => {
                const conf = (result.score * 100).toFixed(0);
                answer += `${idx + 1}. ${result.text} (${conf}%)\n`;
            });
            answer += '\n💡 *اسأل عن أي منطقة للحصول على التفاصيل الكاملة*';
            return answer;
        }
    }

    /**
     * إجابة خاصة بالقرار 104
     */
    function generateDecision104Answer(query, results, intent, extracted) {
        if (extracted && extracted.decision104) {
            let answer = `✅ **نعم، هذا النشاط وارد في القرار 104**\n\n`;
            answer += `📋 **النشاط:** ${extracted.decision104}\n`;
            
            if (extracted.sector) {
                const sectorDesc = extracted.sector === 'أ' ? 
                    'قطاع أ (أولوية عليا - حوافز أكبر)' : 
                    'قطاع ب (أولوية متوسطة)';
                answer += `📊 **القطاع:** ${sectorDesc}`;
            }
            return answer;
        } else if (results.length > 0) {
            const topResult = results[0];
            let answer = `✅ وجدت النشاط التالي في القرار 104:\n\n`;
            answer += `**${topResult.text}**\n\n`;
            answer += `💡 *الثقة: ${(topResult.score * 100).toFixed(0)}%*`;
            return answer;
        } else {
            return '❌ لم أعثر على هذا النشاط في القرار 104.\n\n💡 جرّب إعادة صياغة اسم النشاط أو استخدام مصطلحات بديلة.';
        }
    }

    /**
     * إجابة عامة
     */
    function generateGeneralAnswer(query, results) {
        let answer = `وجدت **${results.length}** نتيجة مطابقة:\n\n`;
        
        results.slice(0, 5).forEach((result, idx) => {
            const confidence = (result.score * 100).toFixed(0);
            const source = result.source === 'activities' ? '📋' : 
                          result.source === 'industrial' ? '🏭' : '💰';
            answer += `${idx + 1}. ${source} ${result.text} (${confidence}%)\n`;
        });

        answer += '\n💡 *اسأل عن أي نتيجة للحصول على التفاصيل*';
        return answer;
    }

    /**
     * الدالة الرئيسية للإجابة
     */
    async function answer(query, history = []) {
        // تحليل النية
        const intent = IntentEngine.parseIntent(query, history);
        const context = IntentEngine.buildContext(history);

        console.log(`🎯 Intent: ${intent.primary.name} (confidence: ${(intent.primary.confidence * 100).toFixed(0)}%)`);

        // تحديد معاملات البحث
        let dataType = 'all';
        let topK = 5;
        let threshold = 0.25;
        
        if (intent.primary.name.startsWith('ACTIVITY')) {
            dataType = 'activities';
            topK = 3;
            threshold = 0.20;
        } else if (intent.primary.name.startsWith('INDUSTRIAL_ZONE')) {
            dataType = 'industrial';
            topK = 10;
            threshold = 0.30;
        } else if (intent.primary.name.startsWith('DECISION104')) {
            dataType = 'decision104';
            topK = 5;
            threshold = 0.25;
        }

        // البحث
        let results = await searchVectors(query, dataType, topK, threshold);

        // إعادة الترتيب
        results = rerankResults(results, intent, context);

        // استخراج المعلومات
        const extracted = extractInformation(results, intent);

        // توليد الإجابة
        const answerText = generateAnswer(query, results, intent, extracted);

        return {
            answer: answerText,
            intent,
            entities: intent.entities,
            sources: results,
            extracted,
            threshold
        };
    }

    // واجهة برمجية بسيطة
    return {
        answer,
        searchVectors
    };
})();
