/**
 * Smart Assistant Intelligence Layer v2 - طبقة ذكاء متطورة
 * يحلل النتائج ويعرضها بذكاء مع فهم عميق للسياق
 */

const SmartAssistantV2 = (() => {
    
    let conversationMemory = {
        lastQuery: null,
        lastResults: null,
        waitingForSelection: false,
        selectedActivity: null,
        selectedIndustrial: null,
        selectedDecision104: null,
        conversationHistory: []
    };
    
    /**
     * المعالجة الذكية الرئيسية مع فهم السياق
     */
    async function processIntelligently(query) {
        console.log('🧠 بدء المعالجة الذكية المحسنة:', query);
        
        // فحص إذا كان المستخدم يختار من خيارات سابقة
        const selection = detectUserSelection(query);
        if (selection.isSelection && conversationMemory.lastResults) {
            return handleSelection(selection.index);
        }
        
        // تحسين الاستعلام بناءً على السياق
        const enhancedQuery = enhanceQueryWithContext(query);
        console.log('📝 الاستعلام المحسّن:', enhancedQuery);
        
        // استخدام ExpertAssistant للبحث
        const rawResult = await ExpertAssistant.processQuery(enhancedQuery);
        
        // تحليل النتائج بذكاء
        const analysis = analyzeResults(rawResult, query);
        
        // حفظ في الذاكرة
        conversationMemory.lastQuery = query;
        conversationMemory.lastResults = rawResult.results;
        conversationMemory.conversationHistory.push({
            query: query,
            timestamp: Date.now()
        });
        
        // توليد الرد الذكي
        return generateSmartResponse(analysis, rawResult);
    }
    
    /**
     * تحسين الاستعلام بناءً على السياق
     */
    function enhanceQueryWithContext(query) {
        const normalized = query.toLowerCase().trim();
        
        // أسئلة تحتاج سياق النشاط المحدد
        const contextualPatterns = [
            { pattern: /^ما هي التراخيص|^التراخيص المطلوبة|^تراخيص/i, needsContext: true },
            { pattern: /^الجهة المختصة|^الجهات المختصة|^من المسؤول/i, needsContext: true },
            { pattern: /^القانون|^السند التشريعي|^التشريع/i, needsContext: true },
            { pattern: /^الدليل|^الإرشادات|^دليل/i, needsContext: true },
            { pattern: /^النقاط الفنية|^الاشتراطات الفنية|^المتطلبات الفنية/i, needsContext: true },
            { pattern: /^الموقع|^المكان|^اين يمكن|^مواقع/i, needsContext: true },
            { pattern: /^التوصيف|^وصف النشاط|^ما هو النشاط/i, needsContext: true }
        ];
        
        const matchedPattern = contextualPatterns.find(p => p.pattern.test(normalized));
        
        if (matchedPattern && matchedPattern.needsContext) {
            // إضافة اسم النشاط/المنطقة المحددة
            if (conversationMemory.selectedActivity) {
                return `${conversationMemory.selectedActivity.name} ${query}`;
            }
            if (conversationMemory.selectedIndustrial) {
                return `${conversationMemory.selectedIndustrial.name} ${query}`;
            }
            if (conversationMemory.selectedDecision104) {
                return `${conversationMemory.selectedDecision104.name} ${query}`;
            }
        }
        
        return query;
    }
    
    /**
     * تحليل النتائج بذكاء
     */
    function analyzeResults(rawResult, query) {
        const results = rawResult.results || [];
        
        console.log('🔍 تحليل', results.length, 'نتيجة');
        
        const classified = {
            activities: [],
            industrial: [],
            decision104: [],
            mixed: false
        };
        
        results.forEach(result => {
            const type = detectResultType(result);
            if (type === 'activity') {
                classified.activities.push(result);
            } else if (type === 'industrial') {
                classified.industrial.push(result);
            } else if (type === 'decision104') {
                classified.decision104.push(result);
            }
        });
        
        // تحديد النوع السائد
        let dominantType = 'unknown';
        let dominantCount = 0;
        
        if (classified.activities.length > dominantCount) {
            dominantType = 'activities';
            dominantCount = classified.activities.length;
        }
        if (classified.industrial.length > dominantCount) {
            dominantType = 'industrial';
            dominantCount = classified.industrial.length;
        }
        if (classified.decision104.length > dominantCount) {
            dominantType = 'decision104';
            dominantCount = classified.decision104.length;
        }
        
        // هل هناك أنواع متعددة؟
        const typesCount = [
            classified.activities.length > 0,
            classified.industrial.length > 0,
            classified.decision104.length > 0
        ].filter(Boolean).length;
        
        classified.mixed = typesCount > 1;
        
        return {
            classified,
            dominantType,
            mixed: classified.mixed,
            totalResults: results.length,
            needsSelection: dominantCount > 1
        };
    }
    
    /**
     * كشف نوع النتيجة
     */
    function detectResultType(result) {
        if (result.id?.includes('activity_')) return 'activity';
        if (result.id?.includes('industrial_')) return 'industrial';
        if (result.id?.includes('DEC_')) return 'decision104';
        
        const text = (result.text || '').toLowerCase();
        const preview = (result.original_data?.text_preview || '').toLowerCase();
        const combined = text + ' ' + preview;
        
        if (combined.includes('ترخيص') || combined.includes('جهة مختصة') || combined.includes('سند تشريعي')) {
            return 'activity';
        }
        if (combined.includes('منطقة صناعية') || combined.includes('قرار محافظ') || combined.includes('جهة الولاية')) {
            return 'industrial';
        }
        if (combined.includes('قطاع') || combined.includes('القرار 104')) {
            return 'decision104';
        }
        
        return 'unknown';
    }
    
    /**
     * كشف اختيار المستخدم
     */
    function detectUserSelection(query) {
        const trimmed = query.trim();
        
        // أرقام مباشرة
        const numberMatch = trimmed.match(/^(\d+)$/);
        if (numberMatch) {
            return { isSelection: true, index: parseInt(numberMatch[1]) - 1 };
        }
        
        // كلمات الاختيار
        const words = {
            'الأول': 0, 'الاول': 0, 'اول': 0, 'أول': 0,
            'الثاني': 1, 'الثانى': 1, 'ثاني': 1, 'ثانى': 1,
            'الثالث': 2, 'ثالث': 2,
            'الرابع': 3, 'رابع': 3,
            'الخامس': 4, 'خامس': 4
        };
        
        for (const [word, index] of Object.entries(words)) {
            if (trimmed.includes(word)) {
                return { isSelection: true, index };
            }
        }
        
        return { isSelection: false };
    }
    
    /**
     * معالجة الاختيار
     */
    async function handleSelection(index) {
        const results = conversationMemory.lastResults;
        
        if (!results || index < 0 || index >= results.length) {
            return {
                answer: '❌ الاختيار غير صحيح. يرجى اختيار رقم من القائمة.',
                type: 'ERROR',
                buttons: [],
                links: [],
                relatedQuestions: []
            };
        }
        
        const selected = results[index];
        const type = detectResultType(selected);
        
        console.log('✅ تم اختيار:', type, index);
        
        conversationMemory.waitingForSelection = false;
        
        // عرض التفاصيل الكاملة
        return generateDetailedView(selected, type);
    }
    
    /**
     * توليد الرد الذكي
     */
    function generateSmartResponse(analysis, rawResult) {
        const { classified, dominantType, mixed, needsSelection, totalResults } = analysis;
        
        // إذا لا توجد نتائج
        if (totalResults === 0) {
            return generateNoResultsMessage();
        }
        
        // إذا كانت نتيجة واحدة - عرض مباشر
        if (totalResults === 1) {
            const firstResult = rawResult.results[0];
            const type = detectResultType(firstResult);
            return generateDetailedView(firstResult, type);
        }
        
        // إذا كانت عدة نتائج من نفس النوع - عرض خيارات
        if (needsSelection && !mixed) {
            conversationMemory.waitingForSelection = true;
            return generateOptionsView(classified, dominantType);
        }
        
        // إذا كانت نتائج مختلطة
        if (mixed) {
            return generateMixedView(classified);
        }
        
        // افتراضي - عرض أول نتيجة
        const firstResult = rawResult.results[0];
        const type = detectResultType(firstResult);
        return generateDetailedView(firstResult, type);
    }
    
    /**
     * عرض الخيارات
     */
    function generateOptionsView(classified, dominantType) {
        let answer = '';
        const buttons = [];
        let items = [];
        
        if (dominantType === 'activities') {
            answer += `## 🎯 وجدت ${classified.activities.length} نشاط مطابق\n\n`;
            answer += `من فضلك اختر النشاط المطلوب للحصول على التفاصيل الكاملة:\n\n`;
            items = classified.activities;
        } else if (dominantType === 'industrial') {
            answer += `## 🏭 وجدت ${classified.industrial.length} منطقة صناعية مطابقة\n\n`;
            answer += `من فضلك اختر المنطقة المطلوبة:\n\n`;
            items = classified.industrial;
        } else if (dominantType === 'decision104') {
            answer += `## 💰 وجدت ${classified.decision104.length} نشاط في القرار 104\n\n`;
            answer += `من فضلك اختر النشاط المطلوب:\n\n`;
            items = classified.decision104;
        }
        
        // إضافة الأزرار بأسماء كاملة وواضحة
        items.forEach((item, idx) => {
            const cleanName = extractCleanName(item, dominantType);
            buttons.push({
                number: idx + 1,
                text: cleanName
            });
        });

        return {
            answer: answer,
            type: 'SELECTION',
            buttons: buttons,
            links: [],
            relatedQuestions: []
        };
    }
    
    /**
     * عرض مختلط
     */
    function generateMixedView(classified) {
        let answer = '## 🔍 نتائج البحث\n\n';
        answer += 'وجدت نتائج من أنواع مختلفة. من فضلك اختر:\n\n';
        
        const buttons = [];
        let counter = 1;
        
        if (classified.activities.length > 0) {
            answer += `### أنشطة (${classified.activities.length})\n`;
            classified.activities.forEach((item) => {
                const name = extractCleanName(item, 'activities');
                buttons.push({
                    number: counter++,
                    text: `نشاط: ${name}`
                });
            });
            answer += '\n';
        }
        
        if (classified.industrial.length > 0) {
            answer += `### مناطق صناعية (${classified.industrial.length})\n`;
            classified.industrial.forEach((item) => {
                const name = extractCleanName(item, 'industrial');
                buttons.push({
                    number: counter++,
                    text: `منطقة: ${name}`
                });
            });
            answer += '\n';
        }
        
        if (classified.decision104.length > 0) {
            answer += `### أنشطة القرار 104 (${classified.decision104.length})\n`;
            classified.decision104.forEach((item) => {
                const name = extractCleanName(item, 'decision104');
                buttons.push({
                    number: counter++,
                    text: `قرار 104: ${name}`
                });
            });
        }

        return {
            answer: answer,
            type: 'MIXED',
            buttons: buttons,
            links: [],
            relatedQuestions: []
        };
    }
    
    /**
     * عرض تفصيلي - محسّن
     */
    function generateDetailedView(result, type) {
        if (type === 'activity') {
            return generateActivityDetailedView(result);
        } else if (type === 'industrial') {
            return generateIndustrialDetailedView(result);
        } else if (type === 'decision104') {
            return generateDecision104DetailedView(result);
        }
        
        return {
            answer: result.text || 'لا توجد معلومات متاحة',
            type: 'GENERIC',
            buttons: [],
            links: [],
            relatedQuestions: []
        };
    }
    
    /**
     * عرض تفصيلي للنشاط - محسّن بشكل كامل
     */
    function generateActivityDetailedView(result) {
        const data = result.original_data || {};
        const details = data.details || {};
        
        let answer = '';
        const buttons = [];
        const links = [];
        
        // العنوان الرئيسي
        const activityName = extractCleanName(result, 'activities');
        answer += `# 🎯 ${activityName}\n\n`;
        
        // حفظ في الذاكرة
        conversationMemory.selectedActivity = {
            name: activityName,
            data: data,
            result: result
        };
        
        // التوصيف
        if (details.act) {
            answer += `## 📋 توصيف النشاط\n`;
            answer += `${formatText(details.act)}\n\n`;
        }
        
        // التراخيص والمتطلبات
        if (details.req) {
            answer += `## 📑 التراخيص والمتطلبات\n`;
            answer += `${formatList(details.req)}\n\n`;
        }
        
        // الجهة المختصة
        if (details.auth) {
            answer += `## 🏛️ الجهة المختصة\n`;
            answer += `${formatText(details.auth)}\n\n`;
        }
        
        // مواقع مزاولة النشاط
        if (details.loc) {
            answer += `## 📍 مواقع مزاولة النشاط\n`;
            answer += `${formatText(details.loc)}\n\n`;
        }
        
        // السند التشريعي
        if (details.leg) {
            answer += `## ⚖️ السند التشريعي\n`;
            answer += `${formatText(details.leg)}\n\n`;
        }
        
        // النقاط الفنية
        if (data.technicalNotes) {
            answer += `## 🔧 النقاط الفنية والاشتراطات\n`;
            answer += `${formatTechnicalPoints(data.technicalNotes)}\n\n`;
        }
        
        // مراحل الإنتاج
        if (data.productionStages && data.productionStages.length > 0) {
            answer += `## 🏭 مراحل الإنتاج\n`;
            data.productionStages.forEach((stage, idx) => {
                answer += `${idx + 1}. ${stage}\n`;
            });
            answer += `\n`;
        }
        
        // الدليل الإرشادي
        if (details.guid && details.link) {
            answer += `## 📘 الدليل الإرشادي\n`;
            answer += `${details.guid}\n\n`;
            
            links.push({
                text: `📥 تحميل ${details.guid}`,
                url: details.link,
                icon: '📥'
            });
        }
        
        // فحص القرار 104
        const in104 = checkIfInDecision104(activityName);
        if (in104) {
            answer += `---\n\n`;
            answer += `## ✅ هذا النشاط مدرج في القرار 104\n`;
            answer += `يستفيد هذا النشاط من الحوافز الاستثمارية المنصوص عليها في قرار رئيس مجلس الوزراء رقم 104.\n\n`;
            
            buttons.push({
                text: '💰 عرض تفاصيل الحوافز',
                action: 'search',
                query: `${activityName} القرار 104`
            });
        } else {
            answer += `---\n\n`;
            answer += `## 📋 هذا النشاط غير مدرج في القرار 104\n`;
        }

        return {
            answer: answer,
            type: 'ACTIVITY_DETAILS',
            buttons: buttons,
            links: links,
            relatedQuestions: [
                'ما هي خطوات الحصول على الترخيص؟',
                'ما هي المستندات المطلوبة؟',
                'كم مدة استخراج الترخيص؟'
            ]
        };
    }
    
    /**
     * عرض تفصيلي للمنطقة الصناعية - محسّن
     */
    function generateIndustrialDetailedView(result) {
        const data = result.original_data || {};
        
        let answer = '';
        const links = [];
        
        // اسم المنطقة
        const zoneName = data.name || extractCleanName(result, 'industrial');
        answer += `# 🏭 ${zoneName}\n\n`;
        
        // حفظ في الذاكرة
        conversationMemory.selectedIndustrial = {
            name: zoneName,
            data: data,
            result: result
        };
        
        // المحافظة
        if (data.governorate) {
            answer += `## 📍 الموقع\n`;
            answer += `**المحافظة:** ${data.governorate}\n\n`;
        }
        
        // جهة الولاية
        if (data.dependency) {
            answer += `## 🏛️ جهة الولاية\n`;
            answer += `${data.dependency}\n\n`;
        }
        
        // المساحة
        if (data.area) {
            answer += `## 📏 المساحة\n`;
            answer += `${data.area} فدان\n\n`;
        }
        
        // قرار الإنشاء
        if (data.decision) {
            answer += `## 📋 قرار الإنشاء\n`;
            answer += `${data.decision}\n\n`;
        }
        
        // رابط الخريطة
        if (data.x && data.y) {
            const mapsUrl = `https://www.google.com/maps?q=${data.y},${data.x}`;
            links.push({
                text: '🗺️ عرض الموقع على الخريطة',
                url: mapsUrl,
                icon: '🗺️'
            });
        } else if (zoneName && data.governorate) {
            const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(zoneName + ' ' + data.governorate)}`;
            links.push({
                text: '🗺️ البحث عن الموقع على الخريطة',
                url: searchUrl,
                icon: '🗺️'
            });
        }

        return {
            answer: answer,
            type: 'INDUSTRIAL_DETAILS',
            buttons: [],
            links: links,
            relatedQuestions: [
                'ما هي المناطق الصناعية الأخرى في نفس المحافظة؟',
                'كيف يمكن الحصول على مكان؟',
                'ما هي الأنشطة المسموح بها؟'
            ]
        };
    }
    
    /**
     * عرض تفصيلي للقرار 104 - محسّن
     */
    function generateDecision104DetailedView(result) {
        const data = result.original_data || {};
        
        let answer = '';
        const links = [];
        
        // اسم النشاط
        const activityName = extractCleanName(result, 'decision104');
        answer += `# 💰 ${activityName}\n\n`;
        answer += `*من أنشطة القرار 104 - يستفيد من الحوافز الاستثمارية*\n\n`;
        
        // حفظ في الذاكرة
        conversationMemory.selectedDecision104 = {
            name: activityName,
            data: data,
            result: result
        };
        
        // القطاع
        const sector = extractSector(result);
        if (sector) {
            answer += `## 🎯 القطاع\n`;
            answer += `${sector}\n\n`;
        }
        
        // معلومات إضافية
        const preview = data.text_preview || '';
        
        // القطاع الرئيسي
        const mainCategoryMatch = preview.match(/\|\s*([^|]+?)\s*\|/);
        if (mainCategoryMatch) {
            answer += `## 📂 القطاع الرئيسي\n`;
            answer += `${mainCategoryMatch[1].trim()}\n\n`;
        }
        
        // رقم النشاط
        const activityNumberMatch = preview.match(/(\d+)\s*-/);
        if (activityNumberMatch) {
            answer += `## #️⃣ رقم النشاط في القرار\n`;
            answer += `${activityNumberMatch[1]}\n\n`;
        }
        
        // الحوافز
        answer += `## 🎁 الحوافز المتاحة\n`;
        answer += `1. إعفاءات ضريبية على الأرباح\n`;
        answer += `2. تخفيضات في أسعار الأراضي الصناعية\n`;
        answer += `3. إجراءات مبسطة للترخيص والتشغيل\n`;
        answer += `4. دعم خاص للمشروعات الصغيرة والمتوسطة\n\n`;
        
        // رابط القرار
        links.push({
            text: '📄 الاطلاع على نص القرار 104 كاملاً',
            url: 'https://www.gafi.gov.eg/Arabic/StartaBusiness/Laws-and-Regulations/Pages/InvestmentIncentives.aspx',
            icon: '📄'
        });

        return {
            answer: answer,
            type: 'DECISION104_DETAILS',
            buttons: [],
            links: links,
            relatedQuestions: [
                'ما هي شروط الاستفادة من الحوافز؟',
                'كيف يمكن التقديم؟',
                'ما هي الأنشطة الأخرى في نفس القطاع؟'
            ]
        };
    }
    
    // ===== دوال مساعدة =====
    
    function extractCleanName(result, type) {
        const data = result.original_data || {};
        
        if (type === 'activities') {
            if (data.text) return data.text;
            if (data.value) return data.value;
            const preview = data.text_preview || '';
            const lines = preview.split('\n');
            if (lines[0]) return lines[0].replace(/النشاط:|الأنشطة:/gi, '').trim();
            return result.text || 'نشاط غير محدد';
        }
        
        if (type === 'industrial') {
            if (data.name) return data.name;
            const preview = data.text_preview || '';
            const match = preview.match(/المنطقة الصناعية\s+(.+?)(?:\n|المحافظة|$)/i);
            if (match) return 'المنطقة الصناعية ' + match[1].trim();
            return result.text || 'منطقة صناعية';
        }
        
        if (type === 'decision104') {
            const preview = data.text_preview || '';
            const match = preview.match(/\d+\s*-\s*(.+?)(?:\n|$)/);
            if (match) return match[1].trim();
            return result.text || 'نشاط القرار 104';
        }
        
        return result.text || 'عنصر';
    }
    
    function formatText(text) {
        if (!text) return '';
        return text.trim();
    }
    
    function formatList(text) {
        if (!text) return '';
        
        const items = text.split(/\n-|\n•|\n\d+\./).filter(i => i.trim());
        
        if (items.length <= 1) return text;
        
        return items.map((item, idx) => `${idx + 1}. ${item.trim()}`).join('\n');
    }
    
    function formatTechnicalPoints(text) {
        if (!text) return '';
        
        if (text.includes('\n1.') || text.includes('\n2.')) {
            return text;
        }
        
        const parts = text.split(/(\d+\.\s*)/);
        let formatted = '';
        let currentNumber = '';
        
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].match(/^\d+\.\s*$/)) {
                currentNumber = parts[i];
            } else if (parts[i].trim() && currentNumber) {
                formatted += `${currentNumber}${parts[i].trim()}\n\n`;
                currentNumber = '';
            } else if (parts[i].trim()) {
                formatted += parts[i].trim() + '\n\n';
            }
        }
        
        return formatted || text;
    }
    
    function extractSector(result) {
        const preview = result.original_data?.text_preview || '';
        if (preview.includes('قطاع أ')) return 'قطاع أ (الأنشطة ذات الأولوية)';
        if (preview.includes('قطاع ب')) return 'قطاع ب (الأنشطة المكملة)';
        return null;
    }
    
    function checkIfInDecision104(activityName) {
        const data = DataLoader.getDataByType('decision104');
        if (!data) return false;
        
        const normalized = activityName.toLowerCase().replace(/[^\u0600-\u06FF\s]/g, '');
        const words = normalized.split(/\s+/).filter(w => w.length > 2);
        
        return data.some(item => {
            const itemText = (item.original_data?.text_preview || '').toLowerCase();
            return words.some(word => itemText.includes(word));
        });
    }
    
    function generateNoResultsMessage() {
        return {
            answer: `❌ **لم أجد نتائج مطابقة لسؤالك**\n\n` +
                   `يرجى:\n` +
                   `• إعادة صياغة السؤال\n` +
                   `• استخدام كلمات أخرى\n` +
                   `• تحديد التفاصيل أكثر\n\n` +
                   `💡 **أمثلة على أسئلة يمكنني الإجابة عليها:**\n` +
                   `• "ما هي تراخيص مصنع ملابس؟"\n` +
                   `• "المناطق الصناعية في القاهرة"\n` +
                   `• "هل صناعة الأدوية في القرار 104؟"`,
            type: 'NO_RESULTS',
            buttons: [],
            links: [],
            relatedQuestions: []
        };
    }
    
    return {
        processIntelligently,
        getMemory: () => conversationMemory
    };
})();
