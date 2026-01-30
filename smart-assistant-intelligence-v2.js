/**
 * Smart Assistant Intelligence Layer - طبقة ذكاء متقدمة
 * يحلل النتائج ويعرضها بذكاء حسب نوع السؤال
 */

const SmartAssistant = (() => {
    
    let conversationMemory = {
        lastQuery: null,
        lastResults: null,
        waitingForSelection: false,
        selectedType: null
    };
    
    /**
     * المعالجة الذكية الرئيسية
     */
    async function processIntelligently(query) {
        console.log('🧠 بدء المعالجة الذكية:', query);
        
        // فحص إذا كان المستخدم يختار من خيارات سابقة
        const selection = detectUserSelection(query);
        if (selection.isSelection && conversationMemory.lastResults) {
            return handleSelection(selection.index);
        }
        
        // استخدام ExpertAssistant الأصلي للبحث
        const rawResult = await ExpertAssistant.processQuery(query);
        
        // تحليل النتائج بذكاء
        const analysis = analyzeResults(rawResult, query);
        
        // حفظ في الذاكرة
        conversationMemory.lastQuery = query;
        conversationMemory.lastResults = rawResult.results;
        
        // توليد الرد الذكي
        return generateSmartResponse(analysis, rawResult);
    }
    
    /**
     * تحليل النتائج بذكاء
     */
    function analyzeResults(rawResult, query) {
        const results = rawResult.results || [];
        
        console.log('🔍 تحليل', results.length, 'نتيجة');
        
        // تصنيف النتائج حسب النوع
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
        
        // هل هناك أنواع متعددة؟
        const typesCount = [
            classified.activities.length > 0 ? 1 : 0,
            classified.industrial.length > 0 ? 1 : 0,
            classified.decision104.length > 0 ? 1 : 0
        ].reduce((a, b) => a + b, 0);
        
        classified.mixed = typesCount > 1;
        
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
        
        // فحص إذا كان السؤال عاماً جداً
        const isVeryGeneric = query.trim().split(/\s+/).length <= 2 && results.length > 3;
        
        // فحص إذا كانت النتائج متشابهة
        const hasSimilarResults = checkSimilarity(results);
        
        console.log('📊 التحليل:', {
            dominantType,
            mixed: classified.mixed,
            isVeryGeneric,
            hasSimilarResults,
            counts: {
                activities: classified.activities.length,
                industrial: classified.industrial.length,
                decision104: classified.decision104.length
            }
        });
        
        return {
            classified,
            dominantType,
            mixed: classified.mixed,
            isVeryGeneric,
            hasSimilarResults,
            totalResults: results.length
        };
    }
    
    /**
     * كشف نوع النتيجة
     */
    function detectResultType(result) {
        // فحص من معرف النتيجة أولاً
        if (result.id) {
            if (result.id.includes('activity_')) return 'activity';
            if (result.id.includes('industrial_')) return 'industrial';
            if (result.id.includes('DEC_')) return 'decision104';
        }
        
        // فحص من النص
        const text = (result.text || '').toLowerCase();
        const preview = (result.original_data?.text_preview || '').toLowerCase();
        const combined = text + ' ' + preview;
        
        // كلمات دالة على الأنشطة
        if (combined.includes('ترخيص') || combined.includes('نشاط') || 
            combined.includes('جهة مختصة') || combined.includes('سند تشريعي')) {
            return 'activity';
        }
        
        // كلمات دالة على المناطق الصناعية
        if (combined.includes('منطقة صناعية') || combined.includes('محافظة') || 
            combined.includes('قرار محافظ') || combined.includes('جهة الولاية')) {
            return 'industrial';
        }
        
        // كلمات دالة على القرار 104
        if (combined.includes('قطاع') || combined.includes('القرار 104')) {
            return 'decision104';
        }
        
        return 'unknown';
    }
    
    /**
     * فحص تشابه النتائج
     */
    function checkSimilarity(results) {
        if (results.length < 2) return false;
        
        // فحص الفرق في النقاط
        const scores = results.map(r => r.score || 0);
        const diff = scores[0] - scores[1];
        
        return diff < 0.15; // نتائج متشابهة
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
                type: 'ERROR'
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
        const { classified, dominantType, mixed, isVeryGeneric, hasSimilarResults } = analysis;
        
        // إذا كان السؤال عاماً جداً أو هناك نتائج متشابهة كثيرة
        if ((isVeryGeneric || hasSimilarResults) && analysis.totalResults > 1) {
            conversationMemory.waitingForSelection = true;
            return generateOptionsView(classified, dominantType);
        }
        
        // إذا كانت هناك نتيجة واحدة واضحة
        if (analysis.totalResults === 1 || (!hasSimilarResults && analysis.totalResults > 0)) {
            const firstResult = rawResult.results[0];
            const type = detectResultType(firstResult);
            return generateDetailedView(firstResult, type);
        }
        
        // لا توجد نتائج
        if (analysis.totalResults === 0) {
            return {
                answer: generateNoResultsMessage(rawResult),
                type: 'NO_RESULTS',
                buttons: [],
                links: []
            };
        }
        
        // حالة افتراضية - عرض خيارات
        conversationMemory.waitingForSelection = true;
        return generateOptionsView(classified, dominantType);
    }
    
    /**
     * عرض الخيارات
     */
    function generateOptionsView(classified, dominantType) {
        let answer = '';
        const buttons = [];
        let results = [];
        
        // تحديد النتائج حسب النوع السائد
        if (dominantType === 'activities' && classified.activities.length > 0) {
            answer = '🤔 **وجدت عدة أنشطة متشابهة. أي منها تقصد؟**\n\n';
            results = classified.activities.slice(0, 5);
            
            results.forEach((result, index) => {
                const name = extractActivityName(result);
                const shortDesc = extractShortDescription(result);
                const confidence = result.score ? (result.score * 100).toFixed(0) : '0';
                
                answer += `**${index + 1}.** ${name}\n`;
                if (shortDesc) answer += `   *${shortDesc}*\n`;
                answer += `   📊 دقة المطابقة: ${confidence}%\n\n`;
                
                // زر بالاسم الكامل
                buttons.push({
                    text: name,
                    number: index + 1
                });
            });
            
        } else if (dominantType === 'industrial' && classified.industrial.length > 0) {
            answer = '🏭 **وجدت عدة مناطق صناعية. أي منها تقصد؟**\n\n';
            results = classified.industrial.slice(0, 5);
            
            results.forEach((result, index) => {
                const name = extractIndustrialName(result);
                const gov = extractGovernorate(result);
                const confidence = result.score ? (result.score * 100).toFixed(0) : '0';
                
                answer += `**${index + 1}.** ${name}\n`;
                if (gov) answer += `   📍 ${gov}\n`;
                answer += `   📊 دقة المطابقة: ${confidence}%\n\n`;
                
                // زر بالاسم الكامل
                buttons.push({
                    text: name,
                    number: index + 1
                });
            });
            
        } else if (dominantType === 'decision104' && classified.decision104.length > 0) {
            answer = '💰 **وجدت عدة أنشطة في القرار 104. أي منها تقصد؟**\n\n';
            results = classified.decision104.slice(0, 5);
            
            results.forEach((result, index) => {
                const name = extractDecision104Name(result);
                const sector = extractSector(result);
                const confidence = result.score ? (result.score * 100).toFixed(0) : '0';
                
                answer += `**${index + 1}.** ${name}\n`;
                if (sector) answer += `   🎯 ${sector}\n`;
                answer += `   📊 دقة المطابقة: ${confidence}%\n\n`;
                
                // زر بالاسم الكامل
                buttons.push({
                    text: name,
                    number: index + 1
                });
            });
        }
        
        return {
            answer: answer,
            type: 'OPTIONS',
            buttons: buttons,
            links: [],
            relatedQuestions: []
        };
    }
    
    /**
     * عرض التفاصيل الكاملة
     */
    function generateDetailedView(result, type) {
        console.log('📄 عرض التفاصيل لـ:', type);
        
        if (type === 'activity') {
            return generateActivityDetails(result);
        } else if (type === 'industrial') {
            return generateIndustrialDetails(result);
        } else if (type === 'decision104') {
            return generateDecision104Details(result);
        }
        
        // عرض عام
        return {
            answer: `### ${result.text || 'نتيجة'}\n\n${result.enrichedText || 'لا توجد تفاصيل إضافية'}`,
            type: 'GENERIC',
            buttons: [],
            links: []
        };
    }
    
    /**
     * عرض تفاصيل النشاط
     */
    function generateActivityDetails(result) {
        const data = result.original_data || {};
        const preview = data.text_preview || '';
        
        let answer = '';
        const links = [];
        const buttons = [];
        
        // اسم النشاط
        const activityName = extractActivityName(result);
        answer += `### 🏢 ${activityName}\n\n`;
        
        // وصف النشاط
        const description = extractActivityDescription(preview);
        if (description) {
            answer += `#### 📝 وصف النشاط:\n${description}\n\n`;
        }
        
        // التراخيص المطلوبة
        const licenses = extractSection(preview, 'التراخيص المطلوبة');
        if (licenses) {
            answer += `#### 📜 التراخيص المطلوبة:\n${licenses}\n\n`;
        }
        
        // الجهة المختصة
        const authority = extractSection(preview, 'الجهة المختصة');
        if (authority) {
            answer += `#### 🏛️ الجهة المختصة:\n${authority}\n\n`;
        }
        
        // السند التشريعي
        const law = extractSection(preview, 'السند التشريعي');
        if (law) {
            answer += `#### ⚖️ السند التشريعي:\n${law}\n\n`;
        }
        
        // مواقع مزاولة النشاط
        const location = extractSection(preview, 'مواقع مزاولة النشاط');
        if (location) {
            answer += `#### 📍 مواقع مزاولة النشاط:\n${location}\n\n`;
        }
        
        // الملاحظات الفنية
        const technical = extractSection(preview, 'النقاط الفنية والإشتراطات');
        if (technical) {
            const formattedTech = formatTechnicalPoints(technical);
            answer += `#### 🔧 الملاحظات والاشتراطات الفنية:\n${formattedTech}\n\n`;
        }
        
        // رابط الدليل
        const guideLink = extractLink(preview);
        if (guideLink) {
            links.push({
                text: '📘 دليل النشاط الإرشادي الكامل',
                url: guideLink,
                icon: '📘'
            });
        }
        
        // فحص إذا كان في القرار 104
        const in104 = checkIfInDecision104(activityName);
        if (in104) {
            answer += `\n---\n\n✅ **هذا النشاط وارد ضمن أنشطة القرار 104 ويستفيد من الحوافز**\n`;
            buttons.push({
                text: '💰 عرض تفاصيل القرار 104',
                action: 'search',
                query: `${activityName} القرار 104`
            });
        } else {
            answer += `\n---\n\n📋 **هذا النشاط غير وارد ضمن أنشطة القرار 104**\n`;
        }
        
        return {
            answer: answer,
            type: 'ACTIVITY_DETAILS',
            buttons: buttons,
            links: links,
            relatedQuestions: [
                'ما هي الاشتراطات الفنية بالتفصيل؟',
                'ما هي خطوات الحصول على الترخيص؟',
                'أين يمكن مزاولة هذا النشاط؟'
            ]
        };
    }
    
    /**
     * عرض تفاصيل المنطقة الصناعية
     */
    function generateIndustrialDetails(result) {
        const data = result.original_data || {};
        const preview = data.text_preview || '';
        
        let answer = '';
        const links = [];
        
        // اسم المنطقة
        const zoneName = extractIndustrialName(result);
        answer += `### 🏭 ${zoneName}\n\n`;
        
        // المحافظة
        const governorate = extractGovernorate(result);
        if (governorate) {
            answer += `**📍 المحافظة:** ${governorate}\n\n`;
        }
        
        // جهة الولاية
        const dependency = extractPattern(preview, /جهة الولاية:?\s*(.+?)(?=قرار|المساحة|$)/i);
        if (dependency) {
            answer += `**🏛️ جهة الولاية:** ${dependency}\n\n`;
        }
        
        // المساحة
        const area = extractPattern(preview, /المساحة:?\s*(.+?)(?=قرار|$)/i);
        if (area) {
            answer += `**📏 المساحة:** ${area}\n\n`;
        }
        
        // قرار الإنشاء
        const decision = extractPattern(preview, /قرار (.+?)$/i);
        if (decision) {
            answer += `**📋 قرار الإنشاء:**\n${decision}\n\n`;
        }
        
        // رابط الخريطة (إذا كانت الإحداثيات موجودة)
        // يمكن استخراجها من البيانات إذا كانت متاحة
        links.push({
            text: '🗺️ عرض الموقع على خرائط Google',
            url: `https://www.google.com/maps/search/${encodeURIComponent(zoneName + ' ' + governorate)}`,
            icon: '🗺️'
        });
        
        return {
            answer: answer,
            type: 'INDUSTRIAL_DETAILS',
            buttons: [],
            links: links,
            relatedQuestions: [
                'ما هي المناطق الصناعية الأخرى في نفس المحافظة؟',
                'ما هي الأنشطة المتاحة في هذه المنطقة؟'
            ]
        };
    }
    
    /**
     * عرض تفاصيل القرار 104
     */
    function generateDecision104Details(result) {
        const data = result.original_data || {};
        const preview = data.text_preview || '';
        
        let answer = '';
        
        // اسم النشاط
        const activityName = extractDecision104Name(result);
        answer += `### 💰 ${activityName}\n\n`;
        answer += `**(من أنشطة القرار 104 - يستفيد من الحوافز الاستثمارية)**\n\n`;
        
        // القطاع
        const sector = extractSector(result);
        if (sector) {
            answer += `**🎯 القطاع:** ${sector}\n\n`;
        }
        
        // القطاع الرئيسي والفرعي
        const mainCategory = extractPattern(preview, /\|\s*(.+?)\s*\|/);
        if (mainCategory) {
            answer += `**📂 القطاع الرئيسي:** ${mainCategory}\n\n`;
        }
        
        // رقم النشاط في القرار
        const activityNumber = extractPattern(preview, /(\d+)\s*-\s*.+$/);
        if (activityNumber) {
            answer += `**#️⃣ رقم النشاط:** ${activityNumber}\n\n`;
        }
        
        answer += `\n---\n\n`;
        answer += `✅ **الحوافز المتاحة لهذا النشاط:**\n`;
        answer += `• إعفاءات ضريبية\n`;
        answer += `• تخفيضات في أسعار الأراضي\n`;
        answer += `• إجراءات ميسرة للترخيص\n`;
        
        return {
            answer: answer,
            type: 'DECISION104_DETAILS',
            buttons: [],
            links: [{
                text: '📄 تفاصيل القرار 104 الكاملة',
                url: 'https://gafi.gov.eg',
                icon: '📄'
            }],
            relatedQuestions: [
                'ما هي الأنشطة الأخرى في نفس القطاع؟',
                'ما هي خطوات الاستفادة من الحوافز؟'
            ]
        };
    }
    
    // ===== دوال مساعدة =====
    
    function extractActivityName(result) {
        return result.text || result.original_data?.text_preview?.split('\n')[0] || 'نشاط غير محدد';
    }
    
    function extractIndustrialName(result) {
        const preview = result.original_data?.text_preview || result.text || '';
        const match = preview.match(/المنطقة الصناعية (.+?)(?=المحافظة|$)/i);
        return match ? match[1].trim() : preview.substring(0, 50);
    }
    
    function extractDecision104Name(result) {
        const preview = result.original_data?.text_preview || result.text || '';
        const match = preview.match(/\d+\s*-\s*(.+?)(?=\d+\s*-|$)/);
        return match ? match[1].trim() : preview.substring(0, 50);
    }
    
    function extractGovernorate(result) {
        const preview = result.original_data?.text_preview || '';
        const match = preview.match(/المحافظة\s+(.+?)(?=جهة|قرار|$)/i);
        return match ? match[1].trim() : null;
    }
    
    function extractSector(result) {
        const preview = result.original_data?.text_preview || '';
        if (preview.includes('قطاع أ')) return 'قطاع أ';
        if (preview.includes('قطاع ب')) return 'قطاع ب';
        return null;
    }
    
    function extractShortDescription(result) {
        const preview = result.original_data?.text_preview || '';
        const lines = preview.split('\n');
        return lines[0]?.substring(0, 60) || null;
    }
    
    function extractActivityDescription(text) {
        const match = text.match(/يخضع (.+?)(?=التراخيص|$)/is);
        return match ? match[1].trim().substring(0, 200) : null;
    }
    
    function extractSection(text, sectionName) {
        const regex = new RegExp(`${sectionName}:([^]+?)(?=الجهة المختصة:|السند التشريعي:|الدليل الإرشادي:|مواقع مزاولة النشاط:|النقاط الفنية:|$)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }
    
    function extractPattern(text, pattern) {
        const match = text.match(pattern);
        return match ? match[1].trim() : null;
    }
    
    function extractLink(text) {
        const match = text.match(/https?:\/\/[^\s]+/);
        return match ? match[0] : null;
    }
    
    function formatTechnicalPoints(text) {
        const points = text.split(/\d+\./);
        let formatted = '';
        points.forEach((point, index) => {
            if (point.trim() && index > 0) {
                formatted += `${index}. ${point.trim()}\n\n`;
            }
        });
        return formatted || text;
    }
    
    function checkIfInDecision104(activityName) {
        // بحث سريع في قاعدة القرار 104
        const data = DataLoader.getDataByType('decision104');
        if (!data) return false;
        
        const normalized = activityName.toLowerCase();
        return data.some(item => {
            const itemText = (item.original_data?.text_preview || '').toLowerCase();
            return itemText.includes(normalized.substring(0, 20));
        });
    }
    
    function generateNoResultsMessage(rawResult) {
        return `❌ **لم أجد نتائج مطابقة لسؤالك**\n\n` +
               `يرجى:\n` +
               `• إعادة صياغة السؤال\n` +
               `• استخدام كلمات أخرى\n` +
               `• تحديد التفاصيل أكثر\n\n` +
               `💡 **أمثلة على أسئلة يمكنني الإجابة عليها:**\n` +
               `• "ما هي تراخيص مصنع ملابس؟"\n` +
               `• "المناطق الصناعية في القاهرة"\n` +
               `• "هل صناعة الأدوية في القرار 104؟"`;
    }
    
    return {
        processIntelligently,
        getMemory: () => conversationMemory
    };
})();
