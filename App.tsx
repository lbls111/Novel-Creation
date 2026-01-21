
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { GameState } from './types';
import type { StoryOutline, GeneratedChapter, StoryOptions, ThoughtStep, StoryLength, Citation, CharacterProfile, WritingMethodology, AntiPatternGuide, AuthorStyle, ActiveTab, WorldEntry, DetailedOutlineAnalysis, FinalDetailedOutline, LogEntry, OutlineGenerationProgress, WorldCategory } from './types';
import { performSearch, generateChapterStream, editChapterText, generateChapterTitles } from './services/geminiService';

import SparklesIcon from './components/icons/SparklesIcon';
import LoadingSpinner from './components/icons/LoadingSpinner';
import SettingsIcon from './components/icons/SettingsIcon';
import SettingsModal from './components/SettingsModal';
import BookOpenIcon from './components/icons/BookOpenIcon';
import UsersIcon from './components/icons/UsersIcon';
import CheckCircleIcon from './components/icons/CheckCircleIcon';
import BrainCircuitIcon from './components/icons/BrainCircuitIcon';
import FilePenIcon from './components/icons/FilePenIcon';
import SearchIcon from './components/icons/SearchIcon';
import MagicWandIcon from './components/icons/MagicWandIcon';
import CharacterArchive from './components/CharacterArchive';
import RefreshCwIcon from './components/icons/RefreshCwIcon';
import DownloadIcon from './components/icons/DownloadIcon';
import OutlineGenerator from './components/OutlineGenerator';
import NotebookTextIcon from './components/icons/NotebookTextIcon';
import WorldbookEditor from './components/WorldbookEditor';
import UploadIcon from './components/icons/UploadIcon';
import ClipboardListIcon from './components/icons/ClipboardListIcon';
import LogViewer from './components/LogViewer';
import ThoughtProcessVisualizer from './components/ThoughtProcessVisualizer';
import StopCircleIcon from './components/icons/StopCircleIcon';


const storyStyles = {
    "爽文短篇 (Web Novel)": ["爽文 (重生复仇打脸)", "爽文 (都市兵王回归)", "爽文 (系统流金手指)", "爽文 (赘婿逆袭)", "爽文 (神医下山)"],
    "玄幻奇幻 (Fantasy/Xuanhuan)": ["玄幻 (修仙升级)", "玄幻 (异界穿越)", "玄幻 (上古神话)", "奇幻 (西式魔幻)", "奇幻 (东方仙侠)"],
    "科幻未来 (Sci-Fi)": ["科幻 (星际歌剧)", "科幻 (赛博朋克)", "科幻 (末日废土)", "科幻 (基因进化)", "科幻 (虚拟现实)"],
    "都市言情 (Urban Romance)": ["言情 (霸道总裁)", "言情 (青春校园)", "言情 (破镜重圆)", "言情 (职场恋爱)", "写实 (家庭伦理)"],
    "悬疑推理 (Mystery/Thriller)": ["悬疑 (刑侦探案)", "悬疑 (心理惊悚)", "悬疑 (恐怖灵异)", "推理 (本格推理)", "推理 (社会派)"],
    "日常故事 (Slice of Life)": ["日常 (趣味吐槽)", "日常 (温馨治愈)", "日常 (都市生活)"],
    "历史军事 (History/Military)": ["历史 (架空穿越)", "历史 (王朝争霸)", "军事 (现代战争)", "军事 (谍战特工)"],
};

const authorStyles: { name: AuthorStyle, description: string }[] = [
    { name: '默认风格', description: '采用通用的“电影导演”人格，注重画面感和节奏。' },
    { name: '爱潜水的乌贼', description: '代表作《诡秘之主》。氛围营造，侧面描写，设定严谨。' },
    { name: '辰东', description: '代表作《遮天》。宏大叙事，战斗场面壮阔，悬念（挖坑）大师。' },
    { name: '猫腻', description: '代表作《庆余年》。文笔细腻，角色立体，于平淡中显惊雷。' },
    { name: '会说话的肘子', description: '代表作《第一序列》。节奏明快，幽默风趣，爽点密集。' },
    { name: '我吃西红柿', description: '代表作《盘龙》。升级体系清晰，目标驱动，纯粹的爽文。' },
    { name: '方想', description: '代表作《师士传说》。设定新颖，战斗体系化，热血团队流。' },
    { name: '孑与2', description: '代表作《唐砖》。于嬉笑怒骂间描绘真实的历史画卷，注重逻辑和细节。' },
    { name: '卖报小郎君', description: '代表作《大奉打更人》。现代文风，对话风趣，擅长将悬疑与日常结合。' },
    { name: '宅猪', description: '代表作《牧神记》。世界观宏大，重构神话，古典热血。' },
    { name: '神医下山风格', description: '一种流派模板。精通“扮猪吃虎”与“打脸”的艺术，提供极致爽点。' },
    { name: '老鹰吃小鸡', description: '代表作《全球高武》。快节奏战斗，杀伐果断，力量体系数值化。' },
    { name: '言归正传', description: '代表作《我师兄实在太稳健了》。现代都市背景，轻松吐槽，风趣幽默。' },
    { name: '远瞳', description: '代表作《异常生物见闻录》。宏大世界观，日常与异常的交织，史诗感。' },
    { name: '方千金', description: '代表作《天才医生》。专业领域碾压，生理反应描写，快节奏打脸。' },
];

const DEFAULT_FORBIDDEN_WORDS = ['冰', '指尖', '尖', '利', '钉', '凉', '惨白', '僵', '颤', '眸', '眼底', '空气', '仿佛', '似乎', '呼吸', '心跳', '肌肉', '绷紧', '深邃', '清冷', '炽热', '精致', '完美', '绝美'];
const DEFAULT_WRITING_METHODOLOGY: WritingMethodology = {
    icebergNarrative: { description: '', application: '' },
    roughLanguage: { description: '', application: '' },
    actionDrivenPlot: { description: '', application: '' },
    functionalEnvironment: { description: '', application: '' },
    meaningfulAction: { description: '', application: '' },
    cinematicTransitions: { description: '', application: '' },
};
const DEFAULT_ANTI_PATTERN_GUIDE: AntiPatternGuide = {
    noInnerMonologue: { description: '', instruction: '' },
    noExposition: { description: '', instruction: '' },
    noMetaphors: { description: '', instruction: '' },
    noCliches: { description: '', instruction: '' },
};
export const DEFAULT_STORY_OPTIONS: StoryOptions = {
    apiBaseUrl: '',
    apiKey: '',
    availableModels: [],
    searchModel: '',
    planningModel: '',
    writingModel: '',
    style: '爽文 (重生复仇打脸)',
    length: '短篇(15-30章)',
    authorStyle: '默认风格',
    temperature: 1.2,
    diversity: 2.0,
    topK: 512,
    forbiddenWords: DEFAULT_FORBIDDEN_WORDS,
};


const getInitialState = () => {
    try {
      const savedSession = localStorage.getItem('saved_story_session');
      if (savedSession) {
        const { storyOutline, chapters, storyOptions, storyCore, generatedTitles, outlineHistory, activeOutlineTitle, thoughtSteps, gameState } = JSON.parse(savedSession);
        
        const mergedOptions = { ...DEFAULT_STORY_OPTIONS, ...(storyOptions || {}) };

        // If we are in the middle of planning, restore that state
        if (gameState === GameState.PLANNING && thoughtSteps) {
            return {
                initialGameState: GameState.PLANNING,
                initialActiveTab: 'agent' as ActiveTab,
                initialStoryCore: storyCore || '',
                initialStoryOutline: null,
                initialChapters: [],
                initialStoryOptions: mergedOptions,
                initialGeneratedTitles: [],
                initialOutlineHistory: {},
                initialActiveOutlineTitle: null,
                initialThoughtSteps: thoughtSteps,
            };
        }

        // Data Migration: Handle old worldEntries format
        if (storyOutline && storyOutline.worldEntries && !storyOutline.worldCategories) {
            storyOutline.worldCategories = [{ name: "核心设定", entries: storyOutline.worldEntries }];
            delete storyOutline.worldEntries;
        }

        if (storyOutline && (!chapters || chapters.length === 0)) {
            return {
                initialGameState: GameState.PLANNING_COMPLETE,
                initialActiveTab: 'outline' as ActiveTab,
                initialStoryCore: storyCore || '',
                initialStoryOutline: storyOutline,
                initialChapters: [],
                initialStoryOptions: mergedOptions,
                initialGeneratedTitles: generatedTitles || [],
                initialOutlineHistory: outlineHistory || {},
                initialActiveOutlineTitle: activeOutlineTitle || null,
                initialThoughtSteps: thoughtSteps || [],
            };
        }
        
        if (chapters && chapters.length > 0 && storyOutline) {
          return {
            initialGameState: GameState.CHAPTER_COMPLETE,
            initialActiveTab: 'writing' as ActiveTab,
            initialStoryCore: storyCore || '',
            initialStoryOutline: storyOutline,
            initialChapters: chapters,
            initialStoryOptions: mergedOptions,
            initialGeneratedTitles: generatedTitles || [],
            initialOutlineHistory: outlineHistory || {},
            initialActiveOutlineTitle: activeOutlineTitle || null,
            initialThoughtSteps: thoughtSteps || [],
          };
        }
      }
    } catch (e) {
      console.error("加载已保存的会话失败:", e);
      localStorage.removeItem('saved_story_session');
    }
    // Default state
    return {
      initialGameState: GameState.INITIAL,
      initialActiveTab: 'agent' as ActiveTab,
      initialStoryCore: '',
      initialStoryOutline: null,
      initialChapters: [],
      initialStoryOptions: DEFAULT_STORY_OPTIONS,
      initialGeneratedTitles: [],
      initialOutlineHistory: {},
      initialActiveOutlineTitle: null,
      initialThoughtSteps: [],
    };
};

const extractAndParseJson = <T,>(
    text: string,
    startTag: string,
    endTag: string,
    stepNameForError: string
): T => {
    if (typeof text !== 'string') {
        throw new Error(`在"${stepNameForError}"步骤中，用于解析的输入文本无效 (预期为字符串，但接收到 ${typeof text})。`);
    }

    const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`);
    const match = text.match(regex);
    
    let jsonString;

    if (match && match[1]) {
       jsonString = match[1].trim();
    } else {
        // This is now a fatal error because we expect the full text from the backend.
        console.error(`Missing markers in text for step "${stepNameForError}":`, text);
        throw new Error(`在"${stepNameForError}"的输出中未能找到完整的数据块 (缺少起始或结束信标)。`);
    }
    
    // Clean potential markdown code blocks
    jsonString = jsonString.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

    try {
        return JSON.parse(jsonString) as T;
    } catch (e: any) {
        console.error(`从步骤 "${stepNameForError}" 解析JSON失败:`, jsonString);
        throw new Error(`解析来自"${stepNameForError}"的JSON数据时失败: ${e.message}`);
    }
};


const App: React.FC = () => {
    const { 
        initialGameState, 
        initialActiveTab,
        initialStoryCore,
        initialStoryOutline, 
        initialChapters, 
        initialStoryOptions,
        initialGeneratedTitles,
        initialOutlineHistory,
        initialActiveOutlineTitle,
        initialThoughtSteps,
    } = useMemo(() => getInitialState(), []);

    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [storyCore, setStoryCore] = useState<string>(initialStoryCore);
    const [storyOptions, setStoryOptions] = useState<StoryOptions>(initialStoryOptions);
    const [activeTab, setActiveTab] = useState<ActiveTab>(initialActiveTab);

    const [storyOutline, setStoryOutline] = useState<StoryOutline | null>(initialStoryOutline);
    const [chapters, setChapters] = useState<GeneratedChapter[]>(initialChapters);
    const [thoughtSteps, setThoughtSteps] = useState<ThoughtStep[]>(initialThoughtSteps);
    const [error, setError] = useState<string | null>(null);
    
    const [editInput, setEditInput] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);


    const [generatedTitles, setGeneratedTitles] = useState<string[]>(initialGeneratedTitles);
    const [outlineHistory, setOutlineHistory] = useState<Record<string, string>>(initialOutlineHistory);
    const [activeOutlineTitle, setActiveOutlineTitle] = useState<string | null>(initialActiveOutlineTitle);
    
    const [planRefinementInput, setPlanRefinementInput] = useState('');
    
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
    
    const workspaceRef = useRef<HTMLDivElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
    const planRefinementInputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        try {
            const savedLogs = localStorage.getItem('app_logs');
            if (savedLogs) {
                setLogs(JSON.parse(savedLogs));
            }
        } catch (e) {
            console.error("Failed to load logs from localStorage", e);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('app_logs', JSON.stringify(logs));
        } catch (e) {
            console.error("Failed to save logs to localStorage", e);
        }
    }, [logs]);
    
    const addLog = useCallback((message: string, type: LogEntry['type']) => {
        const newLog: LogEntry = {
            timestamp: new Date().toISOString(),
            type,
            message,
        };
        setLogs(prevLogs => [newLog, ...prevLogs].slice(0, 100)); // Increased log limit
    }, []);
    
    const handleClearLogs = () => {
        setLogs([]);
        addLog("日志已清除。", 'info');
    };

    useEffect(() => {
        if (gameState !== GameState.INITIAL) {
            const sessionToSave = {
                gameState,
                storyOutline,
                chapters,
                storyOptions,
                storyCore,
                generatedTitles,
                outlineHistory,
                activeOutlineTitle,
                thoughtSteps,
            };
            localStorage.setItem('saved_story_session', JSON.stringify(sessionToSave));
        }
    }, [storyOutline, chapters, storyOptions, gameState, storyCore, generatedTitles, outlineHistory, activeOutlineTitle, thoughtSteps]);


    const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
        setTimeout(() => {
            if (ref.current) {
                ref.current.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
            }
        }, 100);
    };
     
    useEffect(() => {
        if(activeTab === 'writing') {
            scrollToBottom(workspaceRef);
        }
    }, [activeTab, chapters]);

    const updateStoryOutline = (updates: Partial<StoryOutline>) => {
        setStoryOutline(prev => {
            if (prev) {
                return { ...prev, ...updates };
            }
            return null;
        });
    };

    const handleAbort = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            addLog("用户已中止AI生成。", 'info');
        }
    };

    const handleError = (message: string, stepId?: number) => {
        // Ignore abort errors
        if (message.includes('The user aborted a request')) {
            // Reset the state of the step that was running
            setThoughtSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'pending' } : s));
             // Revert from a loading state to a ready state to allow retry.
            setGameState(prev => {
                if (prev === GameState.PLANNING) return storyOutline ? GameState.PLANNING_COMPLETE : GameState.INITIAL;
                if (prev === GameState.WRITING) return GameState.CHAPTER_COMPLETE;
                return prev;
            });
            return;
        }

        setError(message);
        addLog(message, 'error');
        
        // Revert from a loading state to a ready state to allow manual retry
        setGameState(prev => {
            if (prev === GameState.PLANNING) return storyOutline ? GameState.PLANNING_COMPLETE : GameState.INITIAL;
            if (prev === GameState.WRITING) return GameState.CHAPTER_COMPLETE;
            return prev;
        });

        if (stepId !== undefined) {
            setThoughtSteps(prev => prev.map(s => s.id === stepId ? { ...s, status: 'error' } : s));
        }
    };
    
    const parseAndValidateOutlineJSON = (responseText: string): StoryOutline => {
        addLog("开始解析AI生成的JSON创作简报...", 'info');
        let jsonString = responseText;
    
        const jsonStart = responseText.indexOf('{');
        if (jsonStart !== -1) {
            const jsonEnd = responseText.lastIndexOf('}');
            if (jsonEnd > jsonStart) {
                jsonString = responseText.substring(jsonStart, jsonEnd + 1);
            } else {
                 throw new Error("JSON解析失败：在AI的输出中未能找到一个有效的JSON对象结构。");
            }
        } else {
             throw new Error("JSON解析失败：在AI的输出中未能找到JSON对象的起始符号 '{'。");
        }
    
        let parsedData: any;
        try {
            parsedData = JSON.parse(jsonString);
        } catch (e: any) {
            console.error("JSON解析错误:", e, "原始字符串:", jsonString);
            throw new Error(`JSON解析失败：AI返回的文本不是一个有效的JSON格式。错误: ${e.message}`);
        }
        
        const newOutline: Partial<StoryOutline> = {
            title: parsedData.title || '无标题',
            genreAnalysis: parsedData.genreAnalysis || '',
            worldConcept: parsedData.worldConcept || '',
            plotSynopsis: parsedData.plotSynopsis || '',
            characters: parsedData.characters || [],
            worldCategories: parsedData.worldCategories || [],
            writingMethodology: DEFAULT_WRITING_METHODOLOGY,
            antiPatternGuide: DEFAULT_ANTI_PATTERN_GUIDE,
        };
    
        if (!newOutline.plotSynopsis || !newOutline.characters || newOutline.characters.length === 0 || !newOutline.worldCategories || newOutline.worldCategories.length === 0) {
            console.error('JSON验证失败详情:', {
                plot: !!newOutline.plotSynopsis,
                chars: newOutline.characters?.length,
                world: newOutline.worldCategories?.length,
                parsedData: parsedData,
            });
            throw new Error("JSON验证失败：AI生成的JSON中缺少必要的结构（剧情大纲、角色、世界书）。");
        }
    
        addLog("JSON创作简报解析并验证成功。", 'success');
        return newOutline as StoryOutline;
    };

    const handlePlanningSuccess = async (finalOutline: StoryOutline) => {
        setStoryOutline(finalOutline);
        setGameState(GameState.PLANNING_COMPLETE);
        setActiveTab('worldbook');
        addLog("创作计划生成成功。", 'success');
        
        try {
            addLog("开始自动生成初始章节标题...", 'info');
            const titles = await generateChapterTitles(finalOutline, [], storyOptions);
            setGeneratedTitles(titles);
            addLog(`已自动生成 ${titles.length} 个初始章节标题。`, 'success');
        } catch(e: any) {
            handleError("自动生成初始章节标题失败: " + e.message, undefined);
        }
    };
    
    const startAgent = async (coreOverride?: string) => {
        const coreToUse = coreOverride || storyCore;
        if (!coreToUse.trim()) {
            setError("请输入故事核心。");
            return;
        }
        
        if (!storyOptions.apiBaseUrl || !storyOptions.apiKey) {
            setError("API 地址和密钥为必填项。请在“设置”中填写您的 API 凭据。");
            setIsSettingsOpen(true);
            return;
        }

        if (coreOverride && coreOverride !== storyCore) {
            setStoryCore(coreToUse);
        }
        
        setError(null);
        setChapters([]);
        setStoryOutline(null);
        setActiveTab('agent');
        setGeneratedTitles([]);
        setOutlineHistory({});
        setActiveOutlineTitle(null);
        addLog(`启动AI代理，核心创意: "${coreToUse.substring(0, 50)}..."`, 'info');
        
        const initialSteps: ThoughtStep[] = [
            { id: 0, title: "第一步：研究与规划", model: storyOptions.searchModel, content: null, status: 'pending', citations: [] },
        ];
        setThoughtSteps(initialSteps);
        setGameState(GameState.PLANNING);
        setTimeout(() => scrollToBottom(workspaceRef), 100);
        
        const ac = new AbortController();
        setAbortController(ac);

        try {
            setThoughtSteps(prev => prev.map(s => s.id === 0 ? { ...s, status: 'running' } : s));
            const searchResponse = await performSearch(coreToUse, storyOptions, ac.signal);
            const fullResponseText = searchResponse.text;

            setThoughtSteps(prev => prev.map(s => s.id === 0 ? { ...s, status: 'complete', content: fullResponseText, citations: searchResponse.citations } : s));

            if (!fullResponseText) {
                throw new Error("AI未能生成创作简报。请重试。");
            }
            
            const finalOutline = parseAndValidateOutlineJSON(fullResponseText);
            await handlePlanningSuccess(finalOutline);

        } catch (e: any) {
            handleError(e.message, 0);
        } finally {
            setAbortController(null);
        }
    };
    
    const handleRefinePlan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!planRefinementInput.trim() || !storyCore) return;
        const newCore = `${storyCore}\n\n---\n**优化指令:**\n${planRefinementInput}`;
        setPlanRefinementInput('');
        startAgent(newCore);
    };

    const writeChapter = async (
        chapterTitle: string,
        detailedOutlineJson: string,
        explicitHistory?: GeneratedChapter[]
    ) => {
        if (!storyOutline) {
            handleError("无法写入章节，缺少创作计划。请返回重试。");
            return;
        }
        
        let detailedOutlineForChapter: DetailedOutlineAnalysis;
        try {
            const finalOutline = extractAndParseJson<FinalDetailedOutline>(
                detailedOutlineJson,
                '\\[START_DETAILED_OUTLINE_JSON\\]',
                '\\[END_DETAILED_OUTLINE_JSON\\]',
                'chapter writing'
            );
            detailedOutlineForChapter = {
                plotPoints: finalOutline.plotPoints,
                nextChapterPreview: finalOutline.nextChapterPreview,
            };
        } catch (e) {
            handleError(`无法写入章节，细纲数据无效。请重新生成细纲。`);
            return;
        }

        const historyChapters = explicitHistory || chapters;
        
        setActiveTab('writing');
        setGameState(GameState.WRITING);
        setError(null);
        addLog(`开始撰写章节: "${chapterTitle}"`, 'info');
        
        const newChapterId = (historyChapters[historyChapters.length - 1]?.id || 0) + 1;
        const newChapter: GeneratedChapter = {
            id: newChapterId,
            title: chapterTitle,
            content: '',
            preWritingThought: '',
            status: 'streaming',
        };
        setChapters([...historyChapters, newChapter]);
        scrollToBottom(workspaceRef);
        
        const ac = new AbortController();
        setAbortController(ac);

        try {
            const stream = await generateChapterStream(storyOutline, historyChapters, storyOptions, detailedOutlineForChapter, ac.signal);
            let fullText = "";
            const thoughtStartMarker = '[START_THOUGHT_PROCESS]';
            const contentStartMarker = '[START_CHAPTER_CONTENT]';

            for await (const chunk of stream) {
                if (chunk.error) {
                    throw new Error(chunk.error);
                }
                if (typeof chunk.text !== 'string') continue;
                fullText += chunk.text;

                let currentThought = "";
                let currentContent = "";
                
                const contentStartIndex = fullText.indexOf(contentStartMarker);
                
                if (contentStartIndex !== -1) {
                    const thoughtEndIndex = contentStartIndex;
                    const thoughtStartIndex = fullText.indexOf(thoughtStartMarker);
                    currentThought = thoughtStartIndex !== -1 
                        ? fullText.substring(thoughtStartIndex + thoughtStartMarker.length, thoughtEndIndex).trim()
                        : '';
                    currentContent = fullText.substring(contentStartIndex + contentStartMarker.length).trimStart();
                } else {
                    const thoughtStartIndex = fullText.indexOf(thoughtStartMarker);
                     if (thoughtStartIndex !== -1) {
                        currentThought = fullText.substring(thoughtStartIndex + thoughtStartMarker.length).trim();
                    }
                }
                
                setChapters(prev => prev.map(c => 
                    c.id === newChapterId 
                        ? { ...c, content: currentContent, preWritingThought: currentThought } 
                        : c
                ));
            }
            
            let finalThought = "";
            let finalContent = "";
            let finalTitle = newChapter.title;

            const contentStartIndex = fullText.indexOf(contentStartMarker);
            const thoughtStartIndex = fullText.indexOf(thoughtStartMarker);
            
            if (contentStartIndex !== -1) {
                finalThought = thoughtStartIndex !== -1 
                    ? fullText.substring(thoughtStartMarker.length, contentStartIndex).trim()
                    : '';
                
                const contentAndTitleRaw = fullText.substring(contentStartIndex + contentStartMarker.length).trimStart();
                const titleRegex = /(?:章节标题：|Chapter Title:)\s*(.*)/;
                const titleMatch = contentAndTitleRaw.match(titleRegex);

                if (titleMatch) {
                    finalTitle = titleMatch[1] ? titleMatch[1].trim() : finalTitle;
                    finalContent = contentAndTitleRaw.substring(titleMatch.index! + titleMatch[0].length).trimStart();
                } else {
                    finalContent = contentAndTitleRaw;
                }

                if (finalContent.trim() === "" && finalThought.trim() !== "") {
                     setError("错误: AI在完成思考过程后停止了，未能生成正文。请尝试【重新生成】。");
                     addLog("章节生成失败: AI仅生成了思考过程。", 'error');
                     finalContent = "";
                }

            } else if (thoughtStartIndex !== -1) {
                finalThought = fullText.substring(thoughtStartMarker.length).trim();
                setError("错误: AI在完成思考过程后停止了，未能生成正文。请尝试【重新生成】。");
                addLog("章节生成失败: AI仅生成了思考过程。", 'error');
                finalContent = "";
            } else {
                finalContent = fullText;
            }

            setChapters(prev => prev.map(c => 
                c.id === newChapterId 
                    ? { ...c, title: finalTitle, content: finalContent, preWritingThought: finalThought, status: 'complete' } 
                    : c
            ));
            setGameState(GameState.CHAPTER_COMPLETE);
            addLog(`章节 "${finalTitle}" 创作完成。`, 'success');

        } catch (e:any) {
            handleError(e.message || "章节生成过程中发生未知错误。", undefined);
            setChapters(historyChapters);
        } finally {
            setAbortController(null);
        }
    };
    
    // Callback to jump to writing immediately from outline
    const handleWriteChapterFromOutline = (chapterTitle: string, outlineJson: string) => {
        writeChapter(chapterTitle, outlineJson);
    };
    
    const regenerateLastChapter = () => {
        if(chapters.length === 0 || !storyOutline) return;
        
        const lastChapterIndex = chapters.length - 1;
        const targetTitle = generatedTitles[lastChapterIndex];
        const targetOutline = outlineHistory[targetTitle];

        if (!targetOutline) {
             handleError(`无法重新生成第 ${lastChapterIndex + 1} 章，缺少对应的细纲。请先在“细纲”模块中生成。`);
             return;
        }

        const historyChapters = chapters.slice(0, -1);
        writeChapter(targetTitle, targetOutline, historyChapters);
    }
    
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!editInput.trim() || isEditing || chapters.length === 0) return;

        const lastChapter = chapters[chapters.length - 1];
        if(!lastChapter || lastChapter.status !== 'complete') return;
        
        setIsEditing(true);
        setError(null);
        addLog(`开始微调最新章节... 指令: ${editInput}`, 'info');
        const ac = new AbortController();
        setAbortController(ac);

        try {
            const response = await editChapterText(lastChapter.content, editInput, storyOptions, ac.signal);
            const newContent = response.text;
            setChapters(prev => prev.map(c => 
                c.id === lastChapter.id ? { ...c, content: newContent } : c
            ));
            setEditInput('');
            addLog('文本微调成功。', 'success');
        } catch (e: any) {
           handleError(`文本修改失败: ${e.message}`);
        } finally {
            setIsEditing(false);
            setAbortController(null);
        }
    };

    const handleRefineFromSuggestion = (textToRefine: string) => {
        setPlanRefinementInput(`针对以下疑点进行优化：\n"${textToRefine}"\n\n我的想法是：`);
        if (planRefinementInputRef.current) {
            planRefinementInputRef.current.focus();
        }
    };

    const renderThoughtStepContent = (step: ThoughtStep) => {
        if (!step.content) return null;
        if (step.content.trim().startsWith('{')) {
            try {
                const jsonObj = JSON.parse(step.content);
                return (
                    <div className="p-3 bg-slate-800/30 rounded-lg text-sm text-slate-400">
                        <h4 className="font-semibold text-slate-200 mb-2">AI生成的创作简报 (JSON):</h4>
                        <pre className="whitespace-pre-wrap text-xs max-h-96 overflow-auto">
                            {JSON.stringify(jsonObj, null, 2)}
                        </pre>
                    </div>
                );
            } catch (e) { }
        }
        return <ThoughtProcessVisualizer text={step.content} refineCallback={handleRefineFromSuggestion} />;
    };
    
    const handleResetPlan = () => {
        if (window.confirm("确定要重置计划吗？这将清除当前生成的所有内容（大纲、角色、章节），但保留您的核心创意和设置。")) {
            setStoryOutline(null);
            setChapters([]);
            setGeneratedTitles([]);
            setOutlineHistory({});
            setActiveOutlineTitle(null);
            setThoughtSteps([]);
            setError(null);
            setGameState(GameState.PLANNING_COMPLETE);
            setActiveTab('agent');
            addLog("项目已重置，保留核心创意和设置。", 'info');
            startAgent();
        }
    };

    const handleNewProject = () => {
        if (window.confirm("确定要开始一个新项目吗？所有未导出的内容都将丢失。")) {
            localStorage.removeItem('saved_story_session');
            localStorage.removeItem('app_logs');
            window.location.reload();
        }
    };

    const handleExport = async () => {
        if (gameState === GameState.INITIAL && !storyCore && !storyOutline) {
            handleError("没有可导出的内容。请输入核心创意或生成计划后再试。");
            return;
        }

        const exportData = {
            gameState,
            storyOutline,
            chapters,
            storyOptions,
            storyCore,
            generatedTitles,
            outlineHistory,
            activeOutlineTitle,
            thoughtSteps,
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        const safeTitle = (storyOutline?.title || 'story-export').replace(/[^a-z0-9-_\u4E00-\u9FA5]/gi, '_');
        const fileName = `${safeTitle}.json`;

        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'JSON Story File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                addLog(`项目已成功导出为 ${fileName}`, 'success');
                return;
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("文件系统访问API错误:", err);
                    addLog(`使用高级导出模式失败: ${err.message}`, 'error');
                } else {
                    addLog("导出操作已取消。", 'info');
                    return;
                }
            }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog(`项目已成功导出为 ${fileName} (使用备用模式)。`, 'success');
    };
    
    const handleImportClick = () => {
        importFileRef.current?.click();
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("文件读取失败。");
                
                const data = JSON.parse(text);
                if (typeof data !== 'object' || data === null) throw new Error("文件内容不是有效的JSON对象。");

                let storyOutlineToLoad: StoryOutline | null = null;
                let chaptersToLoad: GeneratedChapter[] = [];
                let optionsToLoad: StoryOptions = { ...DEFAULT_STORY_OPTIONS, ...(data.storyOptions || {}) };
                let coreToLoad: string = data.storyCore || '';
                let titlesToLoad: string[] = data.generatedTitles || [];
                let historyToLoad: Record<string, string> = data.outlineHistory || {};
                let activeTitleToLoad: string | null = data.activeOutlineTitle || null;
                let thoughtStepsToLoad: ThoughtStep[] = data.thoughtSteps || [];
                
                if (data.storyOutline && typeof data.storyOutline === 'object') {
                    storyOutlineToLoad = {
                        title: '无标题',
                        genreAnalysis: '',
                        worldConcept: '',
                        plotSynopsis: '',
                        characters: [],
                        writingMethodology: DEFAULT_WRITING_METHODOLOGY,
                        antiPatternGuide: DEFAULT_ANTI_PATTERN_GUIDE,
                        worldCategories: [],
                        ...data.storyOutline
                    };
                    chaptersToLoad = data.chapters || [];
                    if (!coreToLoad) {
                       coreToLoad = storyOutlineToLoad?.plotSynopsis || '';
                    }
                } 
                else {
                    const creativeSeed = JSON.stringify(data, null, 2);
                    coreToLoad = creativeSeed;
                    storyOutlineToLoad = null; 
                    chaptersToLoad = [];
                    titlesToLoad = [];
                    historyToLoad = {};
                    activeTitleToLoad = null;
                }

                setStoryOutline(storyOutlineToLoad);
                setChapters(chaptersToLoad);
                setStoryOptions(optionsToLoad);
                setStoryCore(coreToLoad);
                setGeneratedTitles(titlesToLoad);
                setOutlineHistory(historyToLoad);
                setActiveOutlineTitle(activeTitleToLoad);
                setThoughtSteps(thoughtStepsToLoad);
                setError(null);
                addLog(`成功导入文件: ${file.name}`, 'success');

                if (storyOutlineToLoad) {
                    if (chaptersToLoad.length > 0) {
                        setGameState(GameState.CHAPTER_COMPLETE);
                        setActiveTab('writing');
                    } else {
                        setGameState(GameState.PLANNING_COMPLETE);
                        setActiveTab('outline');
                    }
                } else {
                    setGameState(GameState.INITIAL);
                    startAgent(coreToLoad);
                }


            } catch (err: any) {
                handleError(`导入失败: ${err.message}`);
                setGameState(GameState.INITIAL);
            }
        };
        reader.onerror = () => {
            handleError("读取文件时出错。");
            setGameState(GameState.INITIAL);
        };
        reader.readAsText(file);
        
        if (event.target) {
            event.target.value = '';
        }
    };
    
    const renderInitialView = () => (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
             <div className="absolute top-4 right-4 flex gap-x-2">
                 <button onClick={handleImportClick} className="p-2 rounded-full glass-card glass-interactive transition-all duration-300" title="导入故事">
                    <UploadIcon className="w-6 h-6 text-slate-300"/>
                 </button>
                 <button onClick={handleExport} className="p-2 rounded-full glass-card glass-interactive transition-all duration-300" title="导出故事">
                    <DownloadIcon className="w-6 h-6 text-slate-300"/>
                 </button>
                 <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full glass-card glass-interactive transition-all duration-300" title="设置">
                    <SettingsIcon className="w-6 h-6 text-slate-300"/>
                 </button>
             </div>
             <div className="w-full max-w-3xl p-8 glass-card rounded-2xl shadow-2xl">
                <BrainCircuitIcon className="w-16 h-16 mx-auto text-teal-400 mb-4" />
                <h1 className="text-4xl font-bold text-slate-100 mb-2">AI小说创作代理</h1>
                <p className="text-slate-400 mb-8">输入核心创意。AI将自主研究、构思、决策并创作一部属于你的小说。</p>
                <textarea
                    className="w-full h-28 p-4 bg-slate-900/70 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                    placeholder="输入您的核心创意或故事概念..."
                    value={storyCore}
                    onChange={(e) => setStoryCore(e.target.value)}
                    aria-label="Story Core Idea"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <select value={storyOptions.style} onChange={e => setStoryOptions(o => ({...o, style: e.target.value}))} className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500">
                        {Object.entries(storyStyles).map(([group, options]) => (
                            <optgroup label={group} key={group}>
                                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </optgroup>
                        ))}
                    </select>
                     <select value={storyOptions.length} onChange={e => setStoryOptions(o => ({...o, length: e.target.value as StoryLength}))} className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500">
                         <option value="超短篇(5-10章)">超短篇(5-10章)</option>
                         <option value="短篇(15-30章)">短篇(15-30章)</option>
                         <option value="中篇(30-100章)">中篇(30-100章)</option>
                         <option value="长篇(100章以上)">长篇(100章以上)</option>
                    </select>
                    <select title={authorStyles.find(a => a.name === storyOptions.authorStyle)?.description} value={storyOptions.authorStyle} onChange={e => setStoryOptions(o => ({...o, authorStyle: e.target.value as AuthorStyle}))} className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500">
                         {authorStyles.map(author => (
                            <option key={author.name} value={author.name} title={author.description}>{author.name}</option>
                         ))}
                    </select>
                </div>
                <button
                    className="mt-6 w-full flex items-center justify-center px-8 py-4 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-500 transition-transform transform hover:scale-105 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed"
                    onClick={() => startAgent()}
                    disabled={!storyCore.trim() || gameState === GameState.PLANNING}
                >
                   {gameState === GameState.PLANNING ? <LoadingSpinner className="w-6 h-6 mr-2"/> : <SparklesIcon className="w-6 h-6 mr-2" />}
                   {gameState === GameState.PLANNING ? '正在规划...' : '启动AI代理'}
                </button>
                {error && <p className="mt-4 text-red-400">{error}</p>}
            </div>
        </div>
    );
    
    const renderAgentWorkspace = () => {
        const nextChapterIndex = chapters.length;
        const nextChapterTitle = generatedTitles[nextChapterIndex];

        const isNextChapterOutlined = nextChapterTitle && outlineHistory[nextChapterTitle] && (() => {
            try {
                extractAndParseJson<FinalDetailedOutline>(
                    outlineHistory[nextChapterTitle],
                    '\\[START_DETAILED_OUTLINE_JSON\\]',
                    '\\[END_DETAILED_OUTLINE_JSON\\]',
                    'outline button check'
                );
                return true;
            } catch {
                return false;
            }
        })();
        
        const isWriteButtonDisabled = gameState === GameState.WRITING || !isNextChapterOutlined;
        let writeButtonTooltip = isWriteButtonDisabled ? `请先在“细纲”模块为第 ${nextChapterIndex + 1} 章生成细纲分析。` : '';
        if (gameState === GameState.WRITING) writeButtonTooltip = "正在创作中...";
        if (!storyOptions.writingModel) writeButtonTooltip = "请在设置中选择写作模型。";


        const TabButton: React.FC<{targetTab: ActiveTab; icon: React.ReactNode; label: string;}> = ({ targetTab, icon, label }) => (
             <button
                onClick={() => setActiveTab(targetTab)}
                disabled={!storyOutline}
                className={`flex items-center space-x-2 px-3 py-2 text-sm font-semibold border-b-2 transition-all duration-200 disabled:cursor-not-allowed disabled:text-slate-600 ${
                activeTab === targetTab
                    ? 'border-teal-400 text-teal-300'
                    : 'border-transparent text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
            >
                {icon}
                <span>{label}</span>
            </button>
        );

        const isTaskRunning = gameState === GameState.PLANNING || gameState === GameState.WRITING || isEditing;

        return (
            <div className="h-screen flex flex-col">
                <header className="flex-shrink-0 bg-slate-900/50 backdrop-blur-lg border-b border-white/10 z-20 p-2 flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                        <button 
                                onClick={handleNewProject}
                                className="px-4 py-2 rounded-md font-semibold transition bg-slate-700 text-white hover:bg-slate-600 text-sm"
                            >
                                新项目
                        </button>
                        <h1 className="text-lg font-bold text-slate-200 truncate" title={storyOutline?.title || "AI小说创作代理"}>
                            {storyOutline?.title || "AI小说创作代理"}
                        </h1>
                     </div>
                     <div className="flex items-center space-x-2">
                         {isTaskRunning && (
                            <button 
                                onClick={handleAbort}
                                className="flex items-center gap-x-2 px-4 py-2 rounded-md font-semibold transition bg-red-600 text-white hover:bg-red-500 text-sm"
                                title="停止当前AI任务"
                            >
                                <StopCircleIcon className="w-5 h-5" />
                                <span>停止</span>
                            </button>
                         )}
                        <button 
                            onClick={handleResetPlan}
                            className="px-4 py-2 rounded-md font-semibold transition bg-amber-600 text-white hover:bg-amber-500 text-sm"
                        >
                            重置计划
                        </button>
                         <button onClick={handleImportClick} className="p-2 rounded-full hover:bg-slate-700/50 transition-colors" title="导入故事">
                            <UploadIcon className="w-6 h-6 text-slate-300"/>
                         </button>
                         <button onClick={handleExport} className="p-2 rounded-full hover:bg-slate-700/50 transition-colors" title="导出故事">
                            <DownloadIcon className="w-6 h-6 text-slate-300"/>
                        </button>
                        <button onClick={() => setIsLogViewerOpen(true)} className="p-2 rounded-full hover:bg-slate-700/50 transition-colors" title="查看日志">
                            <ClipboardListIcon className="w-6 h-6 text-slate-300"/>
                        </button>
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-slate-700/50 transition-colors" title="设置">
                            <SettingsIcon className="w-6 h-6 text-slate-300"/>
                        </button>
                     </div>
                </header>

                <div className="flex-shrink-0 border-b border-white/10 bg-slate-950/70 z-10">
                    <nav className="flex space-x-1 px-2">
                        <TabButton targetTab="agent" icon={<BrainCircuitIcon className="w-4 h-4"/>} label="AI思考过程"/>
                        <TabButton targetTab="worldbook" icon={<BookOpenIcon className="w-4 h-4"/>} label="世界书"/>
                        <TabButton targetTab="characters" icon={<UsersIcon className="w-4 h-4"/>} label="角色档案"/>
                        <TabButton targetTab="outline" icon={<NotebookTextIcon className="w-4 h-4"/>} label="细纲"/>
                        <TabButton targetTab="writing" icon={<FilePenIcon className="w-4 h-4"/>} label="创作正文"/>
                    </nav>
                </div>

                <main ref={workspaceRef} className="flex-grow overflow-y-auto bg-slate-900/30">
                    <div className="p-4 md:p-6">
                        {/* REFACTORED: Use CSS display property instead of conditional rendering to persist component state (like spinners) across tab switches. */}
                        <div style={{ display: activeTab === 'agent' ? 'block' : 'none' }}>
                             <div className="space-y-4">
                                {thoughtSteps.map(step => (
                                    <details key={step.id} data-step-id={step.id} className="glass-card rounded-lg" open>
                                        <summary className="p-3 cursor-pointer flex items-center justify-between font-semibold text-slate-200">
                                            <div className="flex items-center">
                                                {step.status === 'running' && <LoadingSpinner className="w-5 h-5 mr-3 text-teal-400" />}
                                                {step.status === 'complete' && <CheckCircleIcon className="w-5 h-5 mr-3 text-green-400" />}
                                                {step.status === 'error' && <CheckCircleIcon className="w-5 h-5 mr-3 text-red-400" />}
                                                {step.status === 'pending' && <div className="w-5 h-5 mr-3 flex items-center justify-center"><div className="w-2.5 h-2.5 border-2 border-slate-600 rounded-full"/></div>}
                                                {step.title}
                                            </div>
                                            <span className="text-xs font-mono bg-slate-700/50 text-sky-300 px-2 py-1 rounded">{step.model}</span>
                                        </summary>
                                        {step.content !== null && (
                                            <div className="p-4 border-t border-white/10">
                                                {renderThoughtStepContent(step)}
                                                {step.citations && step.citations.length > 0 && (
                                                    <div className="mt-4 pt-3 border-t border-white/10">
                                                        <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center"><SearchIcon className="w-4 h-4 mr-2"/>参考文献</h4>
                                                        <ul className="space-y-1.5">{step.citations.map((c, i) => <li key={i}><a href={c.uri} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline text-xs">{c.title || c.uri}</a></li>)}</ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </details>
                                ))}
                                {gameState >= GameState.PLANNING_COMPLETE && storyOutline && (
                                    <div className="mt-6 pt-6 border-t border-white/10">
                                        <div className="glass-card p-4 rounded-lg">
                                            <h3 className="text-lg font-semibold text-slate-200 mb-3">优化创作计划</h3>
                                            <form onSubmit={handleRefinePlan} className="space-y-3">
                                                <textarea
                                                    ref={planRefinementInputRef}
                                                    value={planRefinementInput}
                                                    onChange={e => setPlanRefinementInput(e.target.value)}
                                                    placeholder="输入优化指令，例如：让世界观更黑暗，增加一个敌对组织..."
                                                    rows={4}
                                                    className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-sky-500 transition resize-y"
                                                    disabled={gameState === GameState.PLANNING}
                                                />
                                                <button type="submit" className="w-full flex items-center justify-center px-8 py-3 bg-sky-600 text-white font-bold rounded-lg hover:bg-sky-500 transition-transform transform hover:scale-105 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed" disabled={!planRefinementInput.trim() || gameState === GameState.PLANNING}>
                                                    {gameState === GameState.PLANNING ? <LoadingSpinner className="w-5 h-5 mr-2"/> : <MagicWandIcon className="w-5 h-5 mr-2"/>}
                                                    {gameState === GameState.PLANNING ? '正在重新规划...' : '优化并重新生成'}
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}
                                {error && (
                                    <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300">
                                        <h3 className="font-bold">发生错误</h3>
                                        <p className="text-sm">{error}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {storyOutline && (
                            <>
                                <div style={{ display: activeTab === 'worldbook' ? 'block' : 'none' }}>
                                    <WorldbookEditor storyOutline={storyOutline} onUpdate={updateStoryOutline} storyOptions={storyOptions} />
                                </div>
                                <div style={{ display: activeTab === 'characters' ? 'block' : 'none' }}>
                                    <CharacterArchive storyOutline={storyOutline} onUpdate={updateStoryOutline} storyOptions={storyOptions}/>
                                </div>
                                <div style={{ display: activeTab === 'outline' ? 'block' : 'none' }}>
                                    <OutlineGenerator 
                                        storyOutline={storyOutline} 
                                        chapters={chapters} 
                                        generatedTitles={generatedTitles}
                                        setGeneratedTitles={setGeneratedTitles}
                                        outlineHistory={outlineHistory}
                                        setOutlineHistory={setOutlineHistory}
                                        storyOptions={storyOptions}
                                        activeOutlineTitle={activeOutlineTitle}
                                        setActiveOutlineTitle={setActiveOutlineTitle}
                                        setController={setAbortController}
                                        onStartWriting={handleWriteChapterFromOutline} // Pass the callback for auto-jump
                                    />
                                </div>
                            </>
                        )}
                        
                        <div style={{ display: activeTab === 'writing' ? 'block' : 'none' }}>
                            <div className="max-w-4xl mx-auto">
                                {chapters.map((chapter, index) => (
                                    <div key={chapter.id} className="mb-8 p-6 glass-card rounded-lg">
                                        <h2 className="text-2xl font-bold text-teal-300 mb-4 border-b border-white/10 pb-2">{chapter.title}</h2>
                                        {chapter.preWritingThought && (
                                            <details className="mb-4">
                                                <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-200">查看AI写作思路</summary>
                                                <div className="mt-2 p-3 bg-slate-900/50 rounded-md text-slate-400 text-xs whitespace-pre-wrap font-mono border border-slate-700">
                                                    {chapter.preWritingThought}
                                                </div>
                                            </details>
                                        )}
                                        <div className="prose prose-lg prose-invert max-w-none prose-p:leading-relaxed prose-p:text-slate-300">
                                            {chapter.content.split('\n').map((paragraph, i) => (
                                                <p key={i}>{paragraph}</p>
                                            ))}
                                            {chapter.status === 'streaming' && <span className="inline-block w-3 h-6 bg-slate-300 animate-pulse ml-1" />}
                                        </div>
                                    </div>
                                ))}

                                {gameState === GameState.WRITING && (
                                    <div className="flex justify-center my-8">
                                        <LoadingSpinner className="w-8 h-8 text-teal-400" />
                                    </div>
                                )}
                                
                                {gameState === GameState.CHAPTER_COMPLETE && (
                                     <div className="mt-8 space-y-4">
                                        <div className="flex items-center gap-x-4">
                                            <button 
                                                title={writeButtonTooltip}
                                                disabled={isWriteButtonDisabled || !storyOptions.writingModel}
                                                onClick={() => {
                                                    if (nextChapterTitle && outlineHistory[nextChapterTitle]) {
                                                        writeChapter(nextChapterTitle, outlineHistory[nextChapterTitle]);
                                                    }
                                                }} 
                                                className="flex-grow flex items-center justify-center px-8 py-4 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-500 transition-transform transform hover:scale-105 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed"
                                            >
                                                <FilePenIcon className="w-6 h-6 mr-2" />
                                                写下一章: {nextChapterTitle || `第 ${nextChapterIndex + 1} 章`}
                                            </button>
                                            <button
                                                onClick={regenerateLastChapter}
                                                title="使用相同的细纲重新生成最后一章"
                                                className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                            >
                                                <RefreshCwIcon className="w-6 h-6 text-white"/>
                                            </button>
                                        </div>
                                        <form onSubmit={handleEditSubmit} className="flex items-center gap-x-2">
                                            <input 
                                                type="text"
                                                value={editInput}
                                                onChange={(e) => setEditInput(e.target.value)}
                                                placeholder="输入指令对最新章节进行微调..."
                                                className="w-full p-3 bg-slate-900/70 border border-slate-700 rounded-lg text-slate-200 focus:ring-2 focus:ring-sky-500 transition"
                                                disabled={isEditing}
                                            />
                                            <button type="submit" className="p-3 bg-sky-600 hover:bg-sky-500 rounded-lg disabled:bg-slate-600" disabled={isEditing || !editInput.trim()}>
                                                {isEditing ? <LoadingSpinner className="w-6 h-6 text-white"/> : <MagicWandIcon className="w-6 h-6 text-white"/>}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        )
    };
    
    return (
        <div className="h-screen w-screen overflow-hidden">
            <input type="file" ref={importFileRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
            {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} options={storyOptions} setOptions={setStoryOptions} />}
            <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} logs={logs} onClear={handleClearLogs} />

            {gameState === GameState.INITIAL ? renderInitialView() : renderAgentWorkspace()}
        </div>
    );
};

export default App;
