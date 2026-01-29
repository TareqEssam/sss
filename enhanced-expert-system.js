/**
 * نظام المستشار الخبير المحسّن - Enhanced Expert System
 * يعرض البيانات بذكاء، يفهم الأسئلة المتتابعة، ويوفر تجربة تفاعلية احترافية
 */

const EnhancedExpertSystem = (() => {
    
    // الإعدادات
    const CONFIG = {
        SIMILARITY_THRESHOLD: 0.12,
        HIGH_CONFIDENCE: 0.70,
        MEDIUM_CONFIDENCE: 0.50,
        LOW_CONFIDENCE: 0.30,
        MAX_RESULTS_TO_SHOW: 5,
        AMBIGUITY_SCORE_DIFF: 0.08
    };

    // سياق المحادثة
    let conversationMemory = {
        history: [],
        currentTopic: null,
        lastResults: null,
        userPreferences: {},
        selectedItem: null
    };

    /**
     * معالجة السؤال الرئيسية
     */
    async function processQuery(userQuery) {
        const startTime = performance.now();
        
        try {
            console.log('🚀 معالجة السؤال:', userQuery);

            // تحليل السؤال
            const analysis = analyzeUserQuery(userQuery);
            
            // البحث الذكي في قواعد البيانات
            const searchResults = await smartSearch(userQuery, analysis);
            
            // تحديد نوع الإجابة المطلوبة
            const responseType = determineResponseType(searchResults, analysis);
            
            // توليد الإجابة
            let response;
            if (responseType === 'CLARIFICATION_NEEDED') {
                response = generateClarificationResponse(searchResults, analysis);
            } else if (responseType === 'MULTIPLE_OPTIONS') {
                response = generateOptionsResponse(searchResults, analysis);
            } else {
                response = generateDetailedResponse(searchResults, analysis);
            }
            
            // حفظ في الذاكرة
            updateConversationMemory(userQuery, analysis, searchResults, response);
            
            const processingTime = ((performance.now() - startTime) / 1000).toFixed(2);
            
            return {
                answer: response.answer,
                answerType: response.type,
                intent: analysis.intent,
                entities: analysis.entities,
                results: searchResults.items,
                interactiveButtons: response.buttons || [],
                relatedQuestions: response.relatedQuestions || [],
                links: response.links || [],
                confidence: searchResults.confidence,
                processingTime: processingTime,
                sources: searchResults.sources
            };
            
        } catch (error) {
            console.error('❌ خطأ في المعالجة:', error);
            return {
                answer: 'عذراً، حدث خطأ أثناء معالجة السؤال. يرجى المحاولة مرة أخرى.',
                answerType: 'ERROR',
                confidence: 0,
                processingTime: 0
            };
        }
    }

    /**
     * تحليل السؤال بذكاء
     */
    function analyzeUserQuery(query) {
        const normalized = IntentEngine.normalizeArabic(query);
        const intent = IntentEngine.parseIntent(query, conversationMemory.history);
        const entities = IntentEngine.extractEntities(query);
        
        // كشف الأسئلة المتتابعة
        const isFollowUp = detectFollowUpQuestion(query);
        
        // كشف الغموض
        const isAmbiguous = detectAmbiguity(query, entities);
        
        // تحديد ما إذا كان المستخدم يختار من خيارات سابقة
        const selectionMatch = detectSelection(query);
        
        return {
            original: query,
            normalized: normalized,
            intent: intent,
            entities: entities,
            isFollowUp: isFollowUp,
            isAmbiguous: isAmbiguous,
            isSelection: selectionMatch !== null,
            selectionIndex: selectionMatch,
            questionType: categorizeQuestion(query, intent)
        };
    }

    /**
     * كشف الأسئلة المتتابعة
     */
    function detectFollowUpQuestion(query) {
        const followUpPatterns = [
            /^(و|ثم|أيضا|كمان|كذلك|بعد ذلك)/,
            /^(ماذا عن|وماذا|وما هو|وما هي)/,
            /^(هل|وهل)/,
            /(المزيد|تفاصيل|أكثر|زيادة)/,
            /^(نعم|أجل|طيب|حسنا|تمام)/,
        ];
        
        const normalized = query.trim();
        return followUpPatterns.some(pattern => pattern.test(normalized)) ||
               conversationMemory.history.length > 0;
    }

    /**
     * كشف الغموض في السؤال
     */
    function detectAmbiguity(query, entities) {
        // إذا كان السؤال قصيراً جداً
        if (query.length < 10) return true;
        
        // إذا لم يحتوي على كيانات واضحة
        const totalEntities = Object.values(entities).flat().length;
        if (totalEntities === 0) return true;
        
        // كلمات غامضة
        const vagueWords = ['شيء', 'حاجة', 'هذا', 'ذلك', 'هنا', 'هناك'];
        return vagueWords.some(word => query.includes(word));
    }

    /**
     * كشف اختيار المستخدم من قائمة
     */
    function detectSelection(query) {
        // البحث عن أرقام (1، 2، 3، الخ)
        const numberMatch = query.match(/^(\d+)$/);
        if (numberMatch) {
            return parseInt(numberMatch[1]) - 1;
        }
        
        // البحث عن كلمات الاختيار
        const selectionPatterns = [
            { pattern: /الأول/, index: 0 },
            { pattern: /الثاني/, index: 1 },
            { pattern: /الثالث/, index: 2 },
            { pattern: /الرابع/, index: 3 },
            { pattern: /الخامس/, index: 4 }
        ];
        
        for (const {pattern, index} of selectionPatterns) {
            if (pattern.test(query)) {
                return index;
            }
        }
        
        return null;
    }

    /**
     * تصنيف نوع السؤال
     */
    function categorizeQuestion(query, intent) {
        const intentName = intent?.primary?.name || 'GENERAL';
        
        const categories = {
            // أسئلة الأنشطة
            LICENSE_QUESTION: /ترخيص|رخصة|تراخيص/i.test(query),
            AUTHORITY_QUESTION: /جهة|جهات|مسؤول|وزارة|هيئة/i.test(query),
            LAW_QUESTION: /قانون|تشريع|قرار|لائحة/i.test(query),
            LOCATION_QUESTION: /موقع|مكان|أين|منطقة|مناطق/i.test(query),
            GUIDE_QUESTION: /دليل|إرشاد|خطوات|إجراءات/i.test(query),
            TECHNICAL_QUESTION: /فني|اشتراطات|متطلبات|معايير/i.test(query),
            
            // أسئلة المناطق الصناعية
            INDUSTRIAL_ZONE: intentName.includes('INDUSTRIAL'),
            
            // أسئلة القرار 104
            DECISION_104: intentName.includes('DECISION104'),
            
            // أسئلة عامة
            GENERAL: intentName === 'GENERAL',
            
            // أسئلة المقارنة
            COMPARISON: /مقارنة|الفرق|أفضل|أحسن|يفضل/i.test(query),
            
            // أسئلة التوضيح
            CLARIFICATION: /يعني|أقصد|أعني|المقصود/i.test(query)
        };
        
        return categories;
    }

    /**
     * البحث الذكي
     */
    async function smartSearch(query, analysis) {
        let results = [];
        
        // إذا كان المستخدم يختار من خيارات سابقة
        if (analysis.isSelection && conversationMemory.lastResults) {
            const selectedIndex = analysis.selectionIndex;
            if (selectedIndex >= 0 && selectedIndex < conversationMemory.lastResults.items.length) {
                const selected = conversationMemory.lastResults.items[selectedIndex];
                conversationMemory.selectedItem = selected;
                return {
                    items: [selected],
                    confidence: 1.0,
                    sources: [selected],
                    isSelection: true
                };
            }
        }
        
        // البحث العادي في قواعد البيانات
        const vectorData = DataLoader.getAllData();
        const queryVector = await generateQueryVector(query);
        
        let allMatches = [];
        
        // البحث في كل قاعدة بيانات
        for (const [dbType, data] of Object.entries(vectorData)) {
            if (!data) continue;
            
            for (const item of data) {
                const similarity = calculateCosineSimilarity(
                    queryVector,
                    item.normalizedVector || item.vector
                );
                
                if (similarity > CONFIG.SIMILARITY_THRESHOLD) {
                    allMatches.push({
                        ...item,
                        dbType: dbType,
                        similarity: similarity,
                        text: extractDisplayText(item),
                        enrichedText: extractEnrichedText(item)
                    });
                }
            }
        }
        
        // ترتيب النتائج
        allMatches.sort((a, b) => b.similarity - a.similarity);
        
        // حساب الثقة
        const confidence = allMatches.length > 0 ? allMatches[0].similarity : 0;
        
        // كشف التشابه في النتائج (غموض)
        const hasAmbiguity = allMatches.length > 1 && 
                           (allMatches[0].similarity - allMatches[1].similarity) < CONFIG.AMBIGUITY_SCORE_DIFF;
        
        return {
            items: allMatches.slice(0, 10),
            confidence: confidence,
            sources: allMatches.slice(0, 3),
            hasAmbiguity: hasAmbiguity,
            totalFound: allMatches.length
        };
    }

    /**
     * استخراج النص للعرض
     */
    function extractDisplayText(item) {
        if (item.original_data?.text_preview) {
            return item.original_data.text_preview.substring(0, 200);
        }
        return item.text || item.id || 'نص غير متوفر';
    }

    /**
     * استخراج النص المعزز
     */
    function extractEnrichedText(item) {
        if (!item.original_data) return '';
        
        let enriched = '';
        const data = item.original_data;
        
        if (data.text_preview) {
            enriched += data.text_preview + '\n\n';
        }
        
        return enriched;
    }

    /**
     * تحديد نوع الإجابة المطلوبة
     */
    function determineResponseType(searchResults, analysis) {
        // لا توجد نتائج
        if (searchResults.items.length === 0) {
            return 'NO_RESULTS';
        }
        
        // نتيجة واحدة بثقة عالية
        if (searchResults.items.length === 1 || 
            searchResults.confidence > CONFIG.HIGH_CONFIDENCE) {
            return 'DETAILED_ANSWER';
        }
        
        // سؤال غامض
        if (analysis.isAmbiguous || searchResults.hasAmbiguity) {
            return 'CLARIFICATION_NEEDED';
        }
        
        // نتائج متعددة
        if (searchResults.items.length > 1) {
            return 'MULTIPLE_OPTIONS';
        }
        
        return 'DETAILED_ANSWER';
    }

    /**
     * توليد إجابة تطلب التوضيح
     */
    function generateClarificationResponse(searchResults, analysis) {
        let answer = '🤔 **وجدت عدة احتمالات لسؤالك. هل تقصد:**\n\n';
        
        const buttons = [];
        const topResults = searchResults.items.slice(0, 5);
        
        topResults.forEach((result, index) => {
            const displayText = extractDisplayText(result);
            answer += `**${index + 1}.** ${displayText}\n\n`;
            
            buttons.push({
                text: `${index + 1}. ${displayText.substring(0, 50)}...`,
                action: 'select',
                data: index
            });
        });
        
        answer += '\n💡 **اختر رقم الخيار المناسب أو أعد صياغة سؤالك بشكل أكثر تحديداً**';
        
        return {
            answer: answer,
            type: 'CLARIFICATION',
            buttons: buttons,
            relatedQuestions: generateRelatedQuestions(topResults)
        };
    }

    /**
     * توليد إجابة بخيارات متعددة
     */
    function generateOptionsResponse(searchResults, analysis) {
        const topResults = searchResults.items.slice(0, 5);
        
        let answer = `### 📋 وجدت ${topResults.length} نتيجة ذات صلة:\n\n`;
        
        const buttons = [];
        
        topResults.forEach((result, index) => {
            const displayText = extractDisplayText(result);
            const confidence = (result.similarity * 100).toFixed(0);
            
            answer += `#### ${index + 1}. ${displayText}\n`;
            answer += `*دقة المطابقة: ${confidence}%*\n\n`;
            
            buttons.push({
                text: `${index + 1}. عرض التفاصيل`,
                action: 'select',
                data: index
            });
        });
        
        answer += '\n\n💡 **اختر رقم النتيجة لعرض التفاصيل الكاملة**';
        
        return {
            answer: answer,
            type: 'MULTIPLE_OPTIONS',
            buttons: buttons,
            relatedQuestions: generateRelatedQuestions(topResults)
        };
    }

    /**
     * توليد إجابة تفصيلية
     */
    function generateDetailedResponse(searchResults, analysis) {
        const mainResult = searchResults.items[0];
        const dbType = mainResult.dbType;
        
        if (dbType === 'activities') {
            return generateActivityDetailedResponse(mainResult, analysis);
        } else if (dbType === 'industrial') {
            return generateIndustrialDetailedResponse(mainResult, analysis);
        } else if (dbType === 'decision104') {
            return generateDecision104DetailedResponse(mainResult, analysis);
        }
        
        return generateGenericDetailedResponse(mainResult, analysis);
    }

    /**
     * إجابة تفصيلية للأنشطة
     */
    function generateActivityDetailedResponse(result, analysis) {
        const data = result.original_data;
        let answer = '';
        
        // العنوان
        answer += `### 🏢 ${extractDisplayText(result)}\n\n`;
        
        // البيانات المنظمة
        const sections = extractActivitySections(data);
        const questionType = analysis.questionType;
        
        // عرض حسب نوع السؤال
        if (questionType.LICENSE_QUESTION && sections.licenses) {
            answer += `#### 📜 التراخيص المطلوبة:\n${sections.licenses}\n\n`;
        }
        
        if (questionType.AUTHORITY_QUESTION && sections.authority) {
            answer += `#### 🏛️ الجهة المختصة:\n${sections.authority}\n\n`;
        }
        
        if (questionType.LAW_QUESTION && sections.law) {
            answer += `#### ⚖️ السند القانوني:\n${sections.law}\n\n`;
        }
        
        if (questionType.LOCATION_QUESTION && sections.location) {
            answer += `#### 📍 مواقع مزاولة النشاط:\n${sections.location}\n\n`;
        }
        
        if (questionType.GUIDE_QUESTION && sections.guide) {
            answer += `#### 📖 الدليل الإرشادي:\n${sections.guide}\n\n`;
        }
        
        if (questionType.TECHNICAL_QUESTION && sections.technical) {
            answer += `#### 🔧 النقاط الفنية:\n${sections.technical}\n\n`;
        }
        
        // إذا لم يكن هناك محتوى محدد، اعرض كل شيء
        if (!answer.includes('####')) {
            if (sections.licenses) answer += `#### 📜 التراخيص:\n${sections.licenses}\n\n`;
            if (sections.authority) answer += `#### 🏛️ الجهة المختصة:\n${sections.authority}\n\n`;
            if (sections.law) answer += `#### ⚖️ السند القانوني:\n${sections.law}\n\n`;
            if (sections.location) answer += `#### 📍 المواقع:\n${sections.location}\n\n`;
            if (sections.technical) answer += `#### 🔧 النقاط الفنية:\n${formatTechnicalNotes(sections.technical)}\n\n`;
        }
        
        // الروابط
        const links = [];
        if (sections.guideLink) {
            links.push({
                text: '📘 الدليل الإرشادي الكامل',
                url: sections.guideLink,
                icon: '📘'
            });
        }
        
        // الأزرار التفاعلية
        const buttons = generateActivityButtons(sections);
        
        // الأسئلة ذات الصلة
        const relatedQuestions = [
            'ما هي التراخيص المطلوبة؟',
            'ما هي الجهة المختصة؟',
            'ما هي الاشتراطات الفنية؟',
            'أين يمكن مزاولة هذا النشاط؟'
        ];
        
        return {
            answer: answer,
            type: 'DETAILED_ACTIVITY',
            buttons: buttons,
            links: links,
            relatedQuestions: relatedQuestions
        };
    }

    /**
     * إجابة تفصيلية للمناطق الصناعية
     */
    function generateIndustrialDetailedResponse(result, analysis) {
        const data = result.original_data;
        let answer = '';
        
        answer += `### 🏭 ${data.text_preview || 'منطقة صناعية'}\n\n`;
        
        // استخراج البيانات
        const sections = extractIndustrialSections(data.text_preview);
        
        if (sections.name) {
            answer += `**الاسم:** ${sections.name}\n\n`;
        }
        
        if (sections.governorate) {
            answer += `**📍 المحافظة:** ${sections.governorate}\n\n`;
        }
        
        if (sections.dependency) {
            answer += `**🏛️ جهة الولاية:** ${sections.dependency}\n\n`;
        }
        
        if (sections.area) {
            answer += `**📏 المساحة:** ${sections.area}\n\n`;
        }
        
        if (sections.decision) {
            answer += `**📋 قرار الإنشاء:** ${sections.decision}\n\n`;
        }
        
        // رابط الخريطة
        const links = [];
        if (sections.coordinates) {
            links.push({
                text: '🗺️ عرض الموقع على الخريطة',
                url: `https://www.google.com/maps?q=${sections.coordinates.lat},${sections.coordinates.lng}`,
                icon: '🗺️'
            });
        }
        
        const buttons = [
            { text: '📍 مناطق صناعية أخرى في نفس المحافظة', action: 'search', data: sections.governorate },
            { text: '🏛️ مناطق تابعة لنفس الجهة', action: 'search', data: sections.dependency }
        ];
        
        return {
            answer: answer,
            type: 'DETAILED_INDUSTRIAL',
            buttons: buttons,
            links: links,
            relatedQuestions: [
                'ما هي المناطق الصناعية في نفس المحافظة؟',
                'ما هي قرارات الإنشاء؟'
            ]
        };
    }

    /**
     * إجابة تفصيلية للقرار 104
     */
    function generateDecision104DetailedResponse(result, analysis) {
        const data = result.original_data;
        let answer = '';
        
        answer += `### 💰 ${data.text_preview || 'القرار 104'}\n\n`;
        
        const sections = extractDecision104Sections(data.text_preview);
        
        if (sections.sector) {
            answer += `**🎯 القطاع:** ${sections.sector}\n\n`;
        }
        
        if (sections.category) {
            answer += `**📂 الفئة:** ${sections.category}\n\n`;
        }
        
        if (sections.activity) {
            answer += `**⚙️ النشاط:** ${sections.activity}\n\n`;
        }
        
        answer += `\n💡 **هذا النشاط مشمول بحوافز القرار 104**\n`;
        
        const links = [
            {
                text: '📄 تفاصيل القرار 104',
                url: 'https://gafi.gov.eg',
                icon: '📄'
            }
        ];
        
        return {
            answer: answer,
            type: 'DETAILED_DECISION104',
            buttons: [],
            links: links,
            relatedQuestions: [
                'ما هي الحوافز المتاحة؟',
                'ما هي الأنشطة الأخرى في نفس القطاع؟'
            ]
        };
    }

    /**
     * إجابة عامة
     */
    function generateGenericDetailedResponse(result, analysis) {
        let answer = `### 📋 ${extractDisplayText(result)}\n\n`;
        
        const enrichedText = extractEnrichedText(result);
        if (enrichedText) {
            answer += enrichedText + '\n\n';
        }
        
        return {
            answer: answer,
            type: 'DETAILED_GENERIC',
            buttons: [],
            links: [],
            relatedQuestions: []
        };
    }

    /**
     * استخراج أقسام النشاط
     */
    function extractActivitySections(data) {
        const textPreview = data.text_preview || '';
        
        return {
            licenses: extractPattern(textPreview, /التراخيص المطلوبة:([^]*?)(?=الجهة المختصة:|$)/),
            authority: extractPattern(textPreview, /الجهة المختصة:([^]*?)(?=السند التشريعي:|$)/),
            law: extractPattern(textPreview, /السند التشريعي:([^]*?)(?=الدليل الإرشادي:|$)/),
            guide: extractPattern(textPreview, /الدليل الإرشادي:([^]*?)(?=مواقع مزاولة النشاط:|$)/),
            location: extractPattern(textPreview, /مواقع مزاولة النشاط:([^]*?)(?=النقاط الفنية:|$)/),
            technical: extractPattern(textPreview, /النقاط الفنية والإشتراطات:([^]*?)$/),
            guideLink: extractPattern(textPreview, /https?:\/\/[^\s]+/)
        };
    }

    /**
     * استخراج أقسام المنطقة الصناعية
     */
    function extractIndustrialSections(text) {
        return {
            name: extractPattern(text, /المنطقة الصناعية (.+?)(?=المحافظة|$)/),
            governorate: extractPattern(text, /المحافظة (.+?)(?=جهة الولاية|$)/),
            dependency: extractPattern(text, /جهة الولاية:?\s*(.+?)(?=قرار|$)/),
            area: extractPattern(text, /المساحة:?\s*(.+?)(?=قرار|$)/),
            decision: extractPattern(text, /قرار (.+?)$/),
            coordinates: null // يمكن استخراجها إذا كانت موجودة
        };
    }

    /**
     * استخراج أقسام القرار 104
     */
    function extractDecision104Sections(text) {
        return {
            sector: extractPattern(text, /(قطاع [أب])/),
            category: extractPattern(text, /\|\s*(.+?)\s*\|/),
            activity: extractPattern(text, /\d+\s*-\s*(.+?)(?=\d+\s*-|$)/)
        };
    }

    /**
     * استخراج نمط من النص
     */
    function extractPattern(text, pattern) {
        if (!text) return null;
        const match = text.match(pattern);
        return match ? match[1]?.trim() : null;
    }

    /**
     * تنسيق النقاط الفنية
     */
    function formatTechnicalNotes(technical) {
        if (!technical) return '';
        
        // تقسيم إلى نقاط
        const points = technical.split(/\d+\./);
        let formatted = '';
        
        points.forEach((point, index) => {
            if (point.trim() && index > 0) {
                formatted += `${index}. ${point.trim()}\n\n`;
            }
        });
        
        return formatted || technical;
    }

    /**
     * توليد أزرار تفاعلية للنشاط
     */
    function generateActivityButtons(sections) {
        const buttons = [];
        
        if (sections.licenses) {
            buttons.push({ text: '📜 التراخيص بالتفصيل', action: 'show', data: 'licenses' });
        }
        
        if (sections.technical) {
            buttons.push({ text: '🔧 الاشتراطات الفنية', action: 'show', data: 'technical' });
        }
        
        if (sections.guideLink) {
            buttons.push({ text: '📘 تحميل الدليل الإرشادي', action: 'link', data: sections.guideLink });
        }
        
        buttons.push({ text: '❓ أسئلة شائعة', action: 'faq', data: 'activity' });
        
        return buttons;
    }

    /**
     * توليد أسئلة ذات صلة
     */
    function generateRelatedQuestions(results) {
        const questions = [];
        
        results.forEach(result => {
            const dbType = result.dbType;
            
            if (dbType === 'activities') {
                questions.push('ما هي التراخيص المطلوبة؟');
                questions.push('ما هي الجهة المختصة؟');
            } else if (dbType === 'industrial') {
                questions.push('أين تقع هذه المنطقة؟');
                questions.push('ما هو قرار الإنشاء؟');
            } else if (dbType === 'decision104') {
                questions.push('ما هي الحوافز المتاحة؟');
            }
        });
        
        // إزالة التكرار
        return [...new Set(questions)].slice(0, 4);
    }

    /**
     * حفظ في ذاكرة المحادثة
     */
    function updateConversationMemory(query, analysis, results, response) {
        conversationMemory.history.push({
            query: query,
            analysis: analysis,
            results: results.items.slice(0, 5),
            timestamp: Date.now()
        });
        
        // حفظ آخر 10 محادثات فقط
        if (conversationMemory.history.length > 10) {
            conversationMemory.history.shift();
        }
        
        conversationMemory.currentTopic = analysis.intent.primary?.name;
        conversationMemory.lastResults = results;
    }

    /**
     * توليد متجه للسؤال (بسيط - يمكن تطويره)
     */
    async function generateQueryVector(query) {
        // هنا يمكن استخدام نموذج embedding حقيقي
        // حالياً نستخدم طريقة بسيطة
        const normalized = IntentEngine.normalizeArabic(query);
        const words = normalized.split(/\s+/);
        
        // إنشاء متجه بسيط بناءً على الكلمات
        const vector = new Array(384).fill(0);
        
        words.forEach((word, index) => {
            const hash = simpleHash(word);
            vector[hash % 384] += 1;
        });
        
        return vector;
    }

    /**
     * دالة hash بسيطة
     */
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    /**
     * حساب cosine similarity
     */
    function calculateCosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (normA * normB);
    }

    // الواجهة العامة
    return {
        processQuery,
        getConversationHistory: () => conversationMemory.history,
        clearMemory: () => {
            conversationMemory = {
                history: [],
                currentTopic: null,
                lastResults: null,
                userPreferences: {},
                selectedItem: null
            };
        }
    };
})();
