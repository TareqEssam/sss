/**
 * Expert Assistant Core - المحرك الرئيسي
 * يجمع بين البحث المتجه والفهم السياقي لتوليد إجابات دقيقة
 */

const ExpertAssistant = (() => {
    
    /**
     * Simple embedding function (TF-IDF-like for Arabic)
     * This is a lightweight alternative until we load a proper model
     */
    function simpleEmbed(text) {
        const normalized = IntentEngine.normalizeArabic(text);
        const words = normalized.split(/\s+/);
        
        // Create a simple bag-of-words vector (384 dimensions like the original model)
        const vector = new Array(384).fill(0);
        
        words.forEach((word, idx) => {
            // Simple hash function to distribute words across dimensions
            for (let i = 0; i < word.length; i++) {
                const charCode = word.charCodeAt(i);
                const dimension = (charCode * (i + 1) * (idx + 1)) % 384;
                vector[dimension] += 1 / (i + 1); // Weight by position
            }
        });
        
        // Normalize
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return magnitude > 0 ? vector.map(v => v / magnitude) : vector;
    }

    /**
     * Cosine similarity between two vectors
     */
    function cosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
        
        let dotProduct = 0;
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
        }
        
        return Math.max(0, Math.min(1, dotProduct)); // Clamp to [0, 1]
    }

    /**
     * Keyword matching score
     */
    function keywordScore(query, text) {
        const queryNorm = IntentEngine.normalizeArabic(query);
        const textNorm = IntentEngine.normalizeArabic(text);
        
        const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 2);
        const textWords = textNorm.split(/\s+/);
        
        let matches = 0;
        queryWords.forEach(qWord => {
            if (textWords.some(tWord => tWord.includes(qWord) || qWord.includes(tWord))) {
                matches++;
            }
        });
        
        return queryWords.length > 0 ? matches / queryWords.length : 0;
    }

    /**
     * Search vectors with hybrid approach
     */
    function searchVectors(query, dataType = 'all', topK = 5, threshold = 0.60) {
        const queryVector = simpleEmbed(query);
        const allData = DataLoader.getAllData();
        let results = [];

        // Determine which datasets to search
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

        // Search each dataset
        datasetsToSearch.forEach(dataset => {
            if (!dataset.data) return;

            dataset.data.forEach(item => {
                // Vector similarity
                const vectorSim = item.normalizedVector ? 
                    cosineSimilarity(queryVector, item.normalizedVector) : 0;

                // Keyword matching on enriched text
                const keywordSim = keywordScore(query, item.enriched_text || item.text);

                // Hybrid score (70% vector, 30% keyword)
                const hybridScore = (vectorSim * 0.7) + (keywordSim * 0.3);

                if (hybridScore >= threshold) {
                    results.push({
                        id: item.id,
                        text: item.text,
                        enrichedText: item.enriched_text,
                        score: hybridScore,
                        vectorScore: vectorSim,
                        keywordScore: keywordSim,
                        source: dataset.name,
                        rawData: item
                    });
                }
            });
        });

        // Sort by score and return top K
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }

    /**
     * Re-rank results based on intent and context
     */
    function rerankResults(results, intent, context) {
        if (!intent || results.length === 0) return results;

        return results.map(result => {
            let bonus = 0;

            // Boost based on source relevance
            if (intent.primary.name.startsWith('INDUSTRIAL_ZONE') && result.source === 'industrial') {
                bonus += 0.1;
            } else if (intent.primary.name.startsWith('DECISION104') && result.source === 'decision104') {
                bonus += 0.1;
            } else if (intent.primary.name.startsWith('ACTIVITY') && result.source === 'activities') {
                bonus += 0.1;
            }

            // Boost if entities match
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
     * Extract specific information based on intent
     */
    function extractInformation(results, intent) {
        if (results.length === 0) return null;

        const extracted = {};
        const intentName = intent.primary.name;

        results.forEach(result => {
            if (result.source === 'activities' && result.rawData) {
                const data = result.rawData;
                
                // Parse enriched text to extract structured info
                const enriched = data.enriched_text || '';
                
                if (intentName === 'ACTIVITY_LICENSE') {
                    extracted.licenses = extractSection(enriched, 'المتطلبات:');
                }
                if (intentName === 'ACTIVITY_AUTHORITY') {
                    extracted.authority = extractSection(enriched, 'الجهة:');
                }
                if (intentName === 'ACTIVITY_LAW') {
                    extracted.law = extractSection(enriched, 'القانون:');
                }
                if (intentName === 'ACTIVITY_GUIDE') {
                    extracted.guide = extractSection(enriched, 'الدليل:');
                }
                if (intentName === 'ACTIVITY_LOCATION') {
                    extracted.location = extractSection(enriched, 'الموقع:');
                }
                if (intentName === 'ACTIVITY_TECHNICAL') {
                    extracted.technical = extractSection(enriched, 'ملاحظات فنية:');
                }
                if (intentName === 'ACTIVITY_DESCRIPTION') {
                    extracted.description = extractSection(enriched, 'الإجراءات:');
                }
            }

            if (result.source === 'industrial' && result.rawData) {
                const enriched = result.enrichedText || '';
                
                extracted.zone = result.text;
                extracted.governorate = extractField(enriched, 'المحافظة:');
                extracted.dependency = extractField(enriched, 'التبعية:');
                extracted.area = extractField(enriched, 'المساحة:');
                extracted.decision = extractField(enriched, 'القرار:');
                extracted.location = extractField(enriched, 'موقع:');
            }

            if (result.source === 'decision104' && result.rawData) {
                extracted.decision104 = result.text;
                const enriched = result.enrichedText || '';
                
                // Extract sector
                const sectorMatch = enriched.match(/قطاع\s+([أب])/);
                if (sectorMatch) {
                    extracted.sector = sectorMatch[1];
                }
            }
        });

        return Object.keys(extracted).length > 0 ? extracted : null;
    }

    /**
     * Extract section from enriched text
     */
    function extractSection(text, marker) {
        const parts = text.split('|');
        for (const part of parts) {
            if (part.trim().startsWith(marker)) {
                return part.substring(part.indexOf(':') + 1).trim();
            }
        }
        return null;
    }

    /**
     * Extract field from enriched text
     */
    function extractField(text, marker) {
        const regex = new RegExp(marker + '\\s*([^|]+)', 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * Generate answer from results
     */
    function generateAnswer(query, results, intent, extracted) {
        if (results.length === 0) {
            return 'عذراً، لم أتمكن من العثور على معلومات دقيقة تتعلق بسؤالك. يرجى إعادة صياغة السؤال أو تحديد تفاصيل أكثر.';
        }

        const intentName = intent.primary.name;
        let answer = '';

        // Generate answer based on intent
        if (intentName.startsWith('ACTIVITY')) {
            answer = generateActivityAnswer(query, results, intent, extracted);
        } else if (intentName.startsWith('INDUSTRIAL_ZONE')) {
            answer = generateIndustrialAnswer(query, results, intent, extracted);
        } else if (intentName.startsWith('DECISION104')) {
            answer = generateDecision104Answer(query, results, intent, extracted);
        } else {
            // General answer
            answer = generateGeneralAnswer(query, results);
        }

        return answer;
    }

    /**
     * Generate activity-specific answer
     */
    function generateActivityAnswer(query, results, intent, extracted) {
        const intentName = intent.primary.name;
        let answer = '';

        const topResult = results[0];
        const activityName = topResult.text;

        if (intentName === 'ACTIVITY_LICENSE') {
            answer = `بالنسبة لـ ${activityName}:\n\n`;
            answer += `📋 التراخيص المطلوبة:\n${extracted.licenses || 'لم يتم العثور على معلومات محددة'}`;
        } 
        else if (intentName === 'ACTIVITY_AUTHORITY') {
            answer = `بالنسبة لـ ${activityName}:\n\n`;
            answer += `🏛️ الجهات المختصة:\n${extracted.authority || 'لم يتم العثور على معلومات محددة'}`;
        }
        else if (intentName === 'ACTIVITY_LAW') {
            answer = `بالنسبة لـ ${activityName}:\n\n`;
            answer += `⚖️ السند التشريعي:\n${extracted.law || 'لم يتم العثور على معلومات محددة'}`;
        }
        else if (intentName === 'ACTIVITY_GUIDE') {
            answer = `بالنسبة لـ ${activityName}:\n\n`;
            answer += `📖 الدليل الإرشادي:\n${extracted.guide || 'لم يتم العثور على معلومات محددة'}`;
        }
        else if (intentName === 'ACTIVITY_LOCATION') {
            answer = `بالنسبة لـ ${activityName}:\n\n`;
            answer += `📍 الموقع الملائم:\n${extracted.location || 'لم يتم العثور على معلومات محددة'}`;
        }
        else if (intentName === 'ACTIVITY_TECHNICAL') {
            answer = `بالنسبة لـ ${activityName}:\n\n`;
            answer += `🔧 النقاط الفنية عند المعاينة:\n${extracted.technical || 'لم يتم العثور على معلومات محددة'}`;
            
            // Truncate if too long
            if (answer.length > 1500) {
                const preview = answer.substring(0, 1500);
                answer = preview.substring(0, preview.lastIndexOf('\n')) + '\n\n... (للمزيد من التفاصيل، يمكنك السؤال عن نقطة محددة)';
            }
        }
        else if (intentName === 'ACTIVITY_DESCRIPTION') {
            answer = `بالنسبة لـ ${activityName}:\n\n`;
            answer += `📝 توصيف النشاط:\n${extracted.description || 'لم يتم العثور على معلومات محددة'}`;
        }
        else {
            answer = `وجدت معلومات عن: ${activityName}\n\n`;
            answer += 'يمكنني مساعدتك في معرفة:\n';
            answer += '- التراخيص المطلوبة\n';
            answer += '- الجهات المختصة\n';
            answer += '- القوانين واللوائح\n';
            answer += '- النقاط الفنية للمعاينة\n';
            answer += '\nما الذي تود معرفته تحديداً؟';
        }

        return answer;
    }

    /**
     * Generate industrial zone answer
     */
    function generateIndustrialAnswer(query, results, intent, extracted) {
        const intentName = intent.primary.name;
        let answer = '';

        if (results.length === 1) {
            const zone = extracted.zone || results[0].text;
            
            if (intentName === 'INDUSTRIAL_ZONE_AUTHORITY') {
                answer = `${zone}\n\n`;
                answer += `🏛️ جهة الولاية: ${extracted.dependency || 'غير محدد'}`;
            }
            else if (intentName === 'INDUSTRIAL_ZONE_DECISION') {
                answer = `${zone}\n\n`;
                answer += `📜 قرار الإنشاء: ${extracted.decision || 'غير محدد'}`;
            }
            else if (intentName === 'INDUSTRIAL_ZONE_AREA') {
                answer = `${zone}\n\n`;
                answer += `📐 المساحة: ${extracted.area || 'غير محدد'}`;
            }
            else if (intentName === 'INDUSTRIAL_ZONE_CHECK') {
                answer = `✅ نعم، ${zone} هي منطقة صناعية معتمدة.\n\n`;
                answer += `📍 المحافظة: ${extracted.governorate || 'غير محدد'}\n`;
                answer += `🏛️ التبعية: ${extracted.dependency || 'غير محدد'}`;
            }
            else {
                answer = `${zone}\n\n`;
                answer += `📍 المحافظة: ${extracted.governorate || 'غير محدد'}\n`;
                answer += `🏛️ التبعية: ${extracted.dependency || 'غير محدد'}\n`;
                answer += `📐 المساحة: ${extracted.area || 'غير محدد'}\n`;
                answer += `📜 القرار: ${extracted.decision || 'غير محدد'}`;
            }
        } else {
            // Multiple zones
            answer = `وجدت ${results.length} منطقة صناعية:\n\n`;
            results.forEach((result, idx) => {
                answer += `${idx + 1}. ${result.text}\n`;
            });
            answer += '\nيمكنك السؤال عن أي منطقة محددة للحصول على التفاصيل الكاملة.';
        }

        return answer;
    }

    /**
     * Generate Decision 104 answer
     */
    function generateDecision104Answer(query, results, intent, extracted) {
        let answer = '';

        if (extracted && extracted.decision104) {
            answer = `✅ نعم، هذا النشاط وارد في القرار 104 ويحصل على الحوافز.\n\n`;
            answer += `📋 النشاط: ${extracted.decision104}\n`;
            
            if (extracted.sector) {
                answer += `📊 القطاع: ${extracted.sector === 'أ' ? 'قطاع أ (أولوية عليا)' : 'قطاع ب (أولوية متوسطة)'}`;
            }
        } else if (results.length > 0) {
            const activity = results[0].text;
            answer = `وجدت معلومات عن: ${activity}\n\n`;
            
            // Try to extract sector from enriched text
            const enriched = results[0].enrichedText || '';
            const sectorMatch = enriched.match(/قطاع\s+([أب])/);
            
            if (sectorMatch) {
                const sector = sectorMatch[1];
                answer += `✅ هذا النشاط وارد في القرار 104\n`;
                answer += `📊 القطاع: ${sector === 'أ' ? 'قطاع أ (أولوية عليا)' : 'قطاع ب (أولوية متوسطة)'}`;
            }
        } else {
            answer = '❌ لم أعثر على هذا النشاط في القرار 104. يرجى التأكد من اسم النشاط أو إعادة الصياغة.';
        }

        return answer;
    }

    /**
     * Generate general answer
     */
    function generateGeneralAnswer(query, results) {
        let answer = 'وجدت المعلومات التالية:\n\n';
        
        results.slice(0, 3).forEach((result, idx) => {
            answer += `${idx + 1}. ${result.text}\n`;
        });

        answer += '\nيمكنك السؤال عن أي من هذه العناصر للحصول على تفاصيل أكثر.';
        
        return answer;
    }

    /**
     * Main answer function
     */
    async function answer(query, history = []) {
        // Parse intent
        const intent = IntentEngine.parseIntent(query, history);
        const context = IntentEngine.buildContext(history);

        // Handle complex queries
        const subQueries = IntentEngine.decomposeQuery(query);
        if (subQueries && subQueries.length > 1) {
            // Process each sub-query
            const answers = [];
            for (const subQuery of subQueries) {
                const subResult = await answer(subQuery.text, history);
                answers.push(subResult.answer);
            }
            
            return {
                answer: answers.join('\n\n---\n\n'),
                intent,
                entities: intent.entities,
                sources: [],
                isComplex: true
            };
        }

        // Determine search parameters
        let dataType = 'all';
        let topK = 5;
        
        if (intent.primary.name.startsWith('ACTIVITY')) {
            dataType = 'activities';
            topK = 3;
        } else if (intent.primary.name.startsWith('INDUSTRIAL_ZONE')) {
            dataType = 'industrial';
            topK = 10;
        } else if (intent.primary.name.startsWith('DECISION104')) {
            dataType = 'decision104';
            topK = 5;
        }

        // Get dynamic threshold
        const threshold = IntentEngine.getDynamicThreshold(intent.primary.name);

        // Search
        let results = searchVectors(query, dataType, topK, threshold);

        // Re-rank with context
        results = rerankResults(results, intent, context);

        // Extract structured information
        const extracted = extractInformation(results, intent);

        // Generate answer
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

    return {
        answer,
        searchVectors,
        cosineSimilarity
    };
})();