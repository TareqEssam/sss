/**
 * Enhanced UI Wrapper - غلاف محسّن للواجهة فقط
 * يستخدم ExpertAssistant الأصلي مع إضافة ميزات العرض المحسّن
 */

const EnhancedUI = (() => {
    
    /**
     * معالجة النتائج وتحسين العرض
     */
    function enhanceResponse(originalResponse) {
        const response = { ...originalResponse };
        
        // إذا كانت هناك نتائج متعددة متشابهة، نضيف أزرار
        if (response.results && response.results.length > 1) {
            const topResults = response.results.slice(0, 5);
            
            // فحص إذا كانت النتائج متشابهة
            const firstScore = topResults[0]?.score || 0;
            const secondScore = topResults[1]?.score || 0;
            const scoreDiff = firstScore - secondScore;
            
            // إذا كان الفرق صغير (نتائج متشابهة)
            if (scoreDiff < 0.1 && topResults.length >= 2) {
                response.hasMultipleOptions = true;
                response.interactiveButtons = topResults.map((result, index) => ({
                    text: `${index + 1}. ${extractShortText(result)}`,
                    action: 'select',
                    data: index
                }));
                
                // تعديل الإجابة لتشمل الخيارات
                response.originalAnswer = response.answer;
                response.answer = formatMultipleOptions(topResults, response.answer);
            }
        }
        
        // إضافة روابط مفيدة
        response.links = extractLinks(response);
        
        // إضافة أسئلة مقترحة
        response.relatedQuestions = generateRelatedQuestions(response);
        
        return response;
    }
    
    /**
     * استخراج نص مختصر من النتيجة
     */
    function extractShortText(result) {
        let text = '';
        
        if (result.text) {
            text = result.text;
        } else if (result.original_data?.text_preview) {
            text = result.original_data.text_preview;
        }
        
        // اختصار النص
        if (text.length > 60) {
            text = text.substring(0, 60) + '...';
        }
        
        return text;
    }
    
    /**
     * تنسيق الخيارات المتعددة
     */
    function formatMultipleOptions(results, originalAnswer) {
        let answer = '🤔 **وجدت عدة خيارات متشابهة. أي منها تقصد؟**\n\n';
        
        results.forEach((result, index) => {
            const text = extractShortText(result);
            const score = result.score ? (result.score * 100).toFixed(0) : '0';
            
            answer += `**${index + 1}.** ${text}\n`;
            answer += `   *دقة المطابقة: ${score}%*\n\n`;
        });
        
        answer += '\n💡 **انقر على أحد الأزرار أدناه أو اكتب رقم الخيار**\n\n';
        answer += '---\n\n';
        answer += '*أو إذا كنت تريد رؤية جميع التفاصيل، اكتب "عرض الكل"*';
        
        return answer;
    }
    
    /**
     * استخراج الروابط من الإجابة
     */
    function extractLinks(response) {
        const links = [];
        
        // استخراج روابط من النص
        if (response.answer) {
            const urlRegex = /https?:\/\/[^\s)]+/g;
            const matches = response.answer.match(urlRegex);
            
            if (matches) {
                matches.forEach(url => {
                    let text = 'رابط مفيد';
                    let icon = '🔗';
                    
                    if (url.includes('gafi.gov.eg')) {
                        text = 'موقع الهيئة العامة للاستثمار';
                        icon = '🏛️';
                    } else if (url.includes('pdf')) {
                        text = 'دليل إرشادي (PDF)';
                        icon = '📘';
                    } else if (url.includes('google.com/maps')) {
                        text = 'عرض على الخريطة';
                        icon = '🗺️';
                    }
                    
                    links.push({ text, url, icon });
                });
            }
        }
        
        // إضافة رابط الخريطة للمناطق الصناعية
        if (response.intent?.primary?.name?.includes('INDUSTRIAL')) {
            if (response.results && response.results[0]) {
                const result = response.results[0];
                // يمكن إضافة منطق لاستخراج الإحداثيات
            }
        }
        
        return links;
    }
    
    /**
     * توليد أسئلة مقترحة
     */
    function generateRelatedQuestions(response) {
        const questions = [];
        const intentName = response.intent?.primary?.name || '';
        
        if (intentName.includes('ACTIVITY')) {
            questions.push('ما هي التراخيص المطلوبة؟');
            questions.push('ما هي الجهة المختصة؟');
            questions.push('ما هي الاشتراطات الفنية؟');
            questions.push('أين يمكن مزاولة هذا النشاط؟');
        } else if (intentName.includes('INDUSTRIAL')) {
            questions.push('ما هي المناطق الصناعية الأخرى؟');
            questions.push('ما هو قرار الإنشاء؟');
            questions.push('كم مساحة المنطقة؟');
        } else if (intentName.includes('DECISION104')) {
            questions.push('ما هي الحوافز المتاحة؟');
            questions.push('ما هي الأنشطة الأخرى في نفس القطاع؟');
        }
        
        return questions.slice(0, 4);
    }
    
    /**
     * معالجة اختيار المستخدم
     */
    let lastResults = null;
    
    function handleUserSelection(query, previousResults) {
        // فحص إذا كان المستخدم يختار رقماً
        const numberMatch = query.trim().match(/^(\d+)$/);
        
        if (numberMatch && previousResults) {
            const index = parseInt(numberMatch[1]) - 1;
            
            if (index >= 0 && index < previousResults.length) {
                return {
                    isSelection: true,
                    selectedIndex: index,
                    selectedResult: previousResults[index]
                };
            }
        }
        
        // فحص كلمات الاختيار
        const selectionWords = {
            'الأول': 0,
            'الاول': 0,
            'الثاني': 1,
            'الثالث': 2,
            'الرابع': 3,
            'الخامس': 4
        };
        
        for (const [word, index] of Object.entries(selectionWords)) {
            if (query.includes(word) && previousResults && index < previousResults.length) {
                return {
                    isSelection: true,
                    selectedIndex: index,
                    selectedResult: previousResults[index]
                };
            }
        }
        
        return { isSelection: false };
    }
    
    /**
     * حفظ النتائج الأخيرة
     */
    function saveResults(results) {
        lastResults = results;
    }
    
    /**
     * الحصول على النتائج الأخيرة
     */
    function getLastResults() {
        return lastResults;
    }
    
    return {
        enhanceResponse,
        handleUserSelection,
        saveResults,
        getLastResults
    };
})();
