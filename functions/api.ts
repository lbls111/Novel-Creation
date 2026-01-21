
import {
  getSearchPrompts,
  getChapterPrompts,
  getChapterTitlesPrompts,
  getDetailedOutlinePrompts,
  getCritiqueOutlinePrompts,
  getEditChapterTextPrompts,
  getCharacterInteractionPrompts,
  getNewCharacterProfilePrompts,
  getWorldbookSuggestionsPrompts,
  getCharacterArcSuggestionsPrompts,
  getNarrativeToolboxPrompts,
} from './prompts';

import type { StoryOptions, Citation, FinalDetailedOutline, DetailedOutlineAnalysis, OutlineCritique } from '../types';

interface PagesFunctionContext {
  request: Request;
}

// A more robust helper to extract a JSON object or array from a string.
// REFACTORED: Now uses a greedy heuristic (First {/[ to Last }/]) which is much more robust against
// Markdown formatting variations, extra text, or model chatter.
const extractJsonFromText = (text: string): string => {
    // 1. Try to match markdown code blocks loosely (ignoring case or specific lang tag)
    const markdownMatch = text.match(/```\w*\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1].trim();
    }

    // 2. Heuristic: Find the widest possible JSON object wrapper.
    // We look for the first '{' and the last '}'.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    // 3. Heuristic: Find the widest possible JSON array wrapper.
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');

    let jsonStart = -1;
    let jsonEnd = -1;

    // Determine if we should look for an object or an array based on which comes first
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        if (lastBrace > firstBrace) {
            jsonStart = firstBrace;
            jsonEnd = lastBrace;
        }
    } else if (firstBracket !== -1) {
        if (lastBracket > firstBracket) {
            jsonStart = firstBracket;
            jsonEnd = lastBracket;
        }
    }

    if (jsonStart !== -1 && jsonEnd !== -1) {
        return text.substring(jsonStart, jsonEnd + 1);
    }

    // 4. If all heuristics fail, return original text. 
    // This will likely fail JSON.parse, but the error message will now contain the raw text for debugging.
    return text;
};


// --- Custom OpenAI-Compatible API Helpers ---

async function streamOpenAIResponse(
    apiUrl: string, apiKey: string, model: string, messages: { role: string; content: string }[], options: StoryOptions, writable: WritableStream, action: string
) {
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Helper to send progress updates
    const sendProgress = async (progress: any) => {
        await writer.write(encoder.encode(JSON.stringify(progress) + '\n'));
    };

    try {
        const response = await fetch(new URL('/v1/chat/completions', apiUrl).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model, messages, stream: true, temperature: options.temperature,
                top_p: (options.diversity - 0.1) / 2.0,
                ...(options.topK > 0 && {top_k: options.topK}),
            }),
        });
        if (!response.ok) throw new Error(`Upstream API Error: ${response.status} - ${await response.text()}`);
        if (!response.body) throw new Error("Upstream API response has no body.");
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data.trim() === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices[0]?.delta?.content;
                        if (delta) {
                           await sendProgress({ text: delta });
                        }
                    } catch (e) { /* Ignore parsing errors */ }
                }
            }
        }
    } catch (e: any) {
        await sendProgress({ error: e.message });
    } finally {
        await writer.close();
    }
}

async function postOpenAIRequest(
    apiUrl: string, apiKey: string, model: string, messages: { role: string; content: string }[], options: StoryOptions
): Promise<string> {
    const response = await fetch(new URL('/v1/chat/completions', apiUrl).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model, messages, stream: false, temperature: options.temperature,
            top_p: (options.diversity - 0.1) / 2.0,
            ...(options.topK > 0 && {top_k: options.topK}),
        }),
    });
    if (!response.ok) throw new Error(`Upstream API Error: ${response.status} - ${await response.text()}`);
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("Upstream API returned an empty response.");
    return content;
}

// --- Main Handler ---

export const onRequestPost: (context: PagesFunctionContext) => Promise<Response> = async (context) => {
    let action: string | undefined;
    let model: string = '';

    try {
        const { request } = context;
        const { action: reqAction, payload } = await request.json();
        action = reqAction;
        const { options, ...restPayload } = payload;
        
        if (action === 'listModels') {
            const modelResponse = await fetch(new URL('/v1/models', options.apiBaseUrl).toString(), { headers: { 'Authorization': `Bearer ${options.apiKey}` }});
            if (!modelResponse.ok) throw new Error(`Failed to fetch models: ${modelResponse.status} - ${await modelResponse.text()}`);
            const modelData = await modelResponse.json();
            const modelIds = modelData.data.map((m: any) => m.id).sort();
            return new Response(JSON.stringify(modelIds), { headers: { 'Content-Type': 'application/json' }});
        }
        
        let prompt: { role: string; content: string }[] = [];
        let isStreaming = false;
        
        switch (action) {
            case 'performSearch': case 'generateChapterTitles': 
            case 'editChapterText': case 'generateNewCharacterProfile':
            case 'getWorldbookSuggestions': case 'getCharacterArcSuggestions':
            case 'getNarrativeToolboxSuggestions': case 'generateDetailedOutline': case 'critiqueDetailedOutline':
                isStreaming = false; break;
            case 'generateChapter': case 'generateCharacterInteraction':
                isStreaming = true; break;
            default: throw new Error(`Unknown action: ${action}`);
        }

        switch (action) {
            case 'performSearch': model = options.searchModel; prompt = getSearchPrompts(restPayload.storyCore, options); break;
            case 'generateChapter': model = options.writingModel; prompt = getChapterPrompts(restPayload.outline, restPayload.historyChapters, options, restPayload.detailedChapterOutline); break;
            case 'generateChapterTitles': model = options.planningModel; prompt = getChapterTitlesPrompts(restPayload.outline, restPayload.chapters, options); break;
            case 'generateDetailedOutline': model = options.planningModel; prompt = getDetailedOutlinePrompts(restPayload.outline, restPayload.chapters, restPayload.chapterTitle, options, restPayload.previousAttempt, restPayload.userInput); break;
            case 'critiqueDetailedOutline': model = options.planningModel; prompt = getCritiqueOutlinePrompts(restPayload.outlineToCritique, restPayload.storyOutline, restPayload.chapterTitle, options); break;
            case 'editChapterText': model = options.writingModel; prompt = getEditChapterTextPrompts(restPayload.originalText, restPayload.instruction, options); break;
            case 'generateCharacterInteraction': model = options.planningModel; prompt = getCharacterInteractionPrompts(restPayload.char1, restPayload.char2, restPayload.outline, options); break;
            case 'generateNewCharacterProfile': model = options.planningModel; prompt = getNewCharacterProfilePrompts(restPayload.storyOutline, restPayload.characterPrompt, options); break;
            case 'getWorldbookSuggestions': model = options.planningModel; prompt = getWorldbookSuggestionsPrompts(restPayload.storyOutline, options); break;
            case 'getCharacterArcSuggestions': model = options.planningModel; prompt = getCharacterArcSuggestionsPrompts(restPayload.character, restPayload.storyOutline, options); break;
            case 'getNarrativeToolboxSuggestions': model = options.planningModel; prompt = getNarrativeToolboxPrompts(restPayload.detailedOutline, restPayload.storyOutline, options); break;
        }

        if (!model) throw new Error(`No model selected for action: ${action}. Please check your settings.`);

        if (isStreaming) {
            const { readable, writable } = new TransformStream();
            streamOpenAIResponse(options.apiBaseUrl, options.apiKey, model, prompt, options, writable, action);
            return new Response(readable, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' }});
        } else {
            const resultText = await postOpenAIRequest(options.apiBaseUrl, options.apiKey, model, prompt, options);
            let responseBody;
            
            // Extract JSON with enhanced robustness
            const jsonText = extractJsonFromText(resultText);

            try {
                switch (action) {
                    case 'generateChapterTitles': {
                        responseBody = { titles: JSON.parse(jsonText) };
                        break;
                    }
                    case 'generateDetailedOutline': {
                        responseBody = { outline: JSON.parse(jsonText) as DetailedOutlineAnalysis };
                        break;
                    }
                    case 'critiqueDetailedOutline': {
                        responseBody = { critique: JSON.parse(jsonText) as OutlineCritique };
                        break;
                    }
                    case 'generateNewCharacterProfile': {
                        JSON.parse(jsonText); // Just validation
                        responseBody = { text: jsonText };
                        break;
                    }
                    case 'performSearch':
                        responseBody = { text: resultText, citations: [] }; 
                        break;
                    case 'editChapterText':
                    case 'getWorldbookSuggestions':
                    case 'getCharacterArcSuggestions':
                    case 'getNarrativeToolboxSuggestions':
                        responseBody = { text: resultText }; 
                        break;
                    default:
                        responseBody = { text: resultText };
                }
            } catch (e: any) {
                // IMPORTANT: Provide transparent error feedback
                console.error(`JSON Parsing Failed for Model [${model}]`);
                console.error(`Raw output: ${resultText}`);
                const preview = resultText.length > 500 ? resultText.substring(0, 500) + '... (truncated)' : resultText;
                throw new Error(`Model [${model}] Output Error: The model returned invalid JSON. \n\nError: ${e.message}\n\nRaw Output Preview:\n${preview}`);
            }

            return new Response(JSON.stringify(responseBody), { headers: { 'Content-Type': 'application/json' }});
        }

    } catch (e: any) {
        let status = 500;
        let message = e.message || "An unknown error occurred";
        const upstreamMatch = message.match(/Upstream API Error: (\d+)/);
        if (upstreamMatch && upstreamMatch[1]) {
            const upstreamStatus = parseInt(upstreamMatch[1], 10);
            const rawUpstreamBody = message.substring(message.indexOf('-') + 1).trim();
            if (upstreamStatus === 504 || upstreamStatus === 524) {
                message = `模型 [${model}] 响应超时 (Gateway Timeout)。建议：\n1. 减少“最大优化次数”。\n2. 尝试使用更快的模型（如Flash）。`; status = 504;
            } else if (upstreamStatus === 401) { message = "API密钥无效或未授权。请在设置中检查您的API密钥。"; status = 401;
            } else if (upstreamStatus === 429) { message = "已达到API速率限制 (Rate Limit Exceeded)。请稍后重试。"; status = 429;
            } else if (upstreamStatus === 400) {
                let upstreamError = "上游API报告了一个请求错误。";
                try { const errJson = JSON.parse(rawUpstreamBody); upstreamError = errJson.error?.message || rawUpstreamBody; } catch {}
                 message = `请求错误 (Bad Request): ${upstreamError}`; status = 400;
            } else { message = `上游API服务器错误 (状态码: ${upstreamStatus})。请稍后重试。`; status = upstreamStatus >= 500 ? 502 : 500; }
        }
        
        console.error(`[${new Date().toISOString()}] Action: ${action || 'unknown'} | Model: ${model} | Status: ${status} | Error: ${message}`);
        return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
    }
};
