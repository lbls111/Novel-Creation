
import React, { useState, useMemo, useEffect } from 'react';
import type { StoryOutline, GeneratedChapter, StoryOptions, FinalDetailedOutline, PlotPointAnalysis, OutlineCritique, ScoringDimension, ImprovementSuggestion, OptimizationHistoryEntry, DetailedOutlineAnalysis, OutlineGenerationProgress, StoryLength } from '../types';
import { generateChapterTitles, generateDetailedOutline, critiqueDetailedOutline, generateNarrativeToolboxSuggestions } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';
import LoadingSpinner from './icons/LoadingSpinner';
import SendIcon from './icons/SendIcon';
import CopyIcon from './icons/CopyIcon';
import RefreshCwIcon from './icons/RefreshCwIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon'; // Reused for model indicator
import ThoughtProcessVisualizer from './ThoughtProcessVisualizer';
import FilePenIcon from './icons/FilePenIcon';

interface OutlineGeneratorProps {
    storyOutline: StoryOutline;
    chapters: GeneratedChapter[];
    generatedTitles: string[];
    setGeneratedTitles: React.Dispatch<React.SetStateAction<string[]>>;
    outlineHistory: Record<string, string>;
    setOutlineHistory: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    storyOptions: StoryOptions;
    activeOutlineTitle: string | null;
    setActiveOutlineTitle: React.Dispatch<React.SetStateAction<string | null>>;
    setController: React.Dispatch<React.SetStateAction<AbortController | null>>;
    onStartWriting: (chapterTitle: string, outlineJson: string) => void;
}

// Utility to parse max chapters from the StoryLength string
const getMaxChapters = (lengthStr: StoryLength): number => {
    // Expected formats: "超短篇(5-10章)", "长篇(100章以上)"
    const match = lengthStr.match(/-(\d+)章/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    // Fallback or handle "100章以上" (treat as 2000 for practical infinite)
    if (lengthStr.includes('100章以上')) return 2000;
    // Default fallback
    return 30;
};

const ModelBadge: React.FC<{ model: string }> = ({ model }) => (
    <div className="flex items-center gap-x-1.5 px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/50">
        <BrainCircuitIcon className="w-3.5 h-3.5 text-teal-400" />
        <span className="text-xs font-mono text-slate-400">模型: <span className="text-teal-300 font-semibold">{model || '未配置'}</span></span>
    </div>
);

const AnalysisField: React.FC<{ label: string; value: any; color: string }> = ({ label, value, color }) => {
    if (!value) return null;
    const displayValue = (typeof value === 'object' && value !== null) 
        ? JSON.stringify(value, null, 2) 
        : (value !== null && value !== undefined ? String(value) : '');

    return (
        <div>
            <h5 className={`text-xs font-bold ${color} uppercase tracking-wider`}>{label}</h5>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{displayValue}</p>
        </div>
    );
};

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const percentage = score * 10;
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (percentage / 100) * circumference;

    const getColor = (s: number) => {
        if (s >= 9) return 'text-green-400';
        if (s >= 7.5) return 'text-sky-400';
        if (s >= 6) return 'text-amber-400';
        return 'text-red-400';
    };

    const getTrackColor = (s: number) => {
        if (s >= 9) return 'stroke-green-400/20';
        if (s >= 7.5) return 'stroke-sky-400/20';
        if (s >= 6) return 'stroke-amber-400/20';
        return 'stroke-red-400/20';
    };

    const getStrokeColor = (s: number) => {
        if (s >= 9) return 'stroke-green-400';
        if (s >= 7.5) return 'stroke-sky-400';
        if (s >= 6) return 'stroke-amber-400';
        return 'stroke-red-400';
    }


    return (
        <div className="relative w-32 h-32">
            <svg className="w-full h-full" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                    className={getTrackColor(score)}
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                />
                {/* Progress circle */}
                <circle
                    className={`${getStrokeColor(score)} transition-all duration-1000 ease-out`}
                    strokeWidth="8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="40"
                    cx="50"
                    cy="50"
                    style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: offset,
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%'
                    }}
                />
            </svg>
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${getColor(score)}`}>
                <span className="text-4xl font-bold">{score.toFixed(1)}</span>
                <span className="text-xs uppercase font-semibold tracking-wider">综合评分</span>
            </div>
        </div>
    );
};

const CritiqueDisplay: React.FC<{ critique: OutlineCritique }> = ({ critique }) => (
    <div className="p-4 bg-slate-950/40 rounded-lg border border-slate-700/50 space-y-6">
        {critique.thoughtProcess && (
            <div className="pb-6 border-b border-slate-700">
                <h4 className="text-lg font-bold text-slate-100 mb-3">AI 创作思路</h4>
                <ThoughtProcessVisualizer text={critique.thoughtProcess} />
            </div>
        )}
        <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
                <ScoreCircle score={critique.overallScore} />
            </div>
            <div className="w-full">
                <h4 className="text-lg font-bold text-slate-100 mb-3">第三方评估报告</h4>
                <div className="space-y-2 text-sm">
                {critique.scoringBreakdown.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-md">
                        <span className={`font-semibold ${item.dimension.includes('情绪') ? 'text-rose-300' : 'text-slate-300'}`}>{item.dimension}</span>
                        <span className={`font-bold ${item.score >= 9 ? 'text-green-400' : item.score >= 7.5 ? 'text-sky-400' : item.score >= 6 ? 'text-amber-400' : 'text-red-400'}`}>{item.score.toFixed(1)}</span>
                    </div>
                ))}
                </div>
            </div>
        </div>
        <div>
            <h5 className="text-base font-bold text-amber-300 mb-3">优化建议 (对标《庆余年》《大奉打更人》)</h5>
            <ul className="space-y-3">
                {critique.improvementSuggestions.map((item, index) => (
                    <li key={index} className="p-3 bg-slate-800/40 rounded-lg border-l-4 border-amber-400/50">
                        <p className="font-semibold text-slate-200 text-sm">{item.area}</p>
                        <p className="text-slate-400 text-sm mt-1">{item.suggestion}</p>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const OptimizationHistoryDisplay: React.FC<{ history: OptimizationHistoryEntry[] }> = ({ history }) => {
    if (!history || history.length === 0) return null;

    const reversedHistory = [...history].reverse();

    return (
        <div className="space-y-4">
            <h4 className="text-lg font-bold text-slate-100">优化历史记录</h4>
            {reversedHistory.map(entry => (
                <details key={entry.version} className="bg-slate-950/40 rounded-lg border border-slate-700/50">
                    <summary className="p-3 cursor-pointer font-semibold text-slate-200 flex justify-between items-center">
                        <span>v{entry.version} - 综合评分: <span className="font-bold text-amber-300">{entry.critique.overallScore.toFixed(1)}</span></span>
                         <span className="text-xs text-slate-500 group-open:hidden">点击展开</span>
                    </summary>
                    <div className="p-4 border-t border-slate-700/50">
                         <CritiqueDisplay critique={entry.critique} />
                         <div className="mt-4">
                             <h5 className="text-base font-bold text-slate-300 mb-2">v{entry.version} 稿件摘要</h5>
                             <div className="p-3 bg-slate-800/30 rounded-lg space-y-2 text-sm max-h-60 overflow-y-auto">
                                {entry.outline.plotPoints.map((pp, idx) => (
                                    <p key={idx} className="text-slate-400 border-b border-slate-700/50 pb-1 last:border-b-0">
                                        <span className="font-semibold text-slate-300">剧情点 {idx + 1}: </span>{pp.summary}
                                    </p>
                                ))}
                             </div>
                         </div>
                    </div>
                </details>
            ))}
        </div>
    );
};


const OutlineGenerator: React.FC<OutlineGeneratorProps> = ({ 
    storyOutline, 
    chapters, 
    generatedTitles, 
    setGeneratedTitles, 
    outlineHistory, 
    setOutlineHistory,
    storyOptions,
    activeOutlineTitle,
    setActiveOutlineTitle,
    setController,
    onStartWriting
}) => {
    const [isLoadingTitles, setIsLoadingTitles] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [generationStatus, setGenerationStatus] = useState<string | null>(null);
    
    const [isCopied, setIsCopied] = useState(false);

    const [isToolboxLoading, setIsToolboxLoading] = useState(false);
    const [toolboxResult, setToolboxResult] = useState<string | null>(null);
    const [toolboxError, setToolboxError] = useState<string | null>(null);

    // Calculate Limits
    const maxChapters = useMemo(() => getMaxChapters(storyOptions.length), [storyOptions.length]);
    const currentChapterCount = generatedTitles.length;
    // Strictly cap the remaining chapters
    const remainingChapters = Math.max(0, maxChapters - currentChapterCount);
    const isMaxReached = remainingChapters <= 0;

    // Clear toolbox result when active outline changes
    useEffect(() => {
        setToolboxResult(null);
        setToolboxError(null);
        setError(null);
    }, [activeOutlineTitle]);

    const parsedOutline = useMemo<FinalDetailedOutline | null>(() => {
        if (!activeOutlineTitle || !outlineHistory[activeOutlineTitle]) return null;
        try {
            const text = outlineHistory[activeOutlineTitle];
            const startTag = '\\[START_DETAILED_OUTLINE_JSON\\]';
            const endTag = '\\[END_DETAILED_OUTLINE_JSON\\]';
            const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`);
            const match = text.match(regex);
            
            if (!match || !match[1]) {
                return null;
            }
            
            let jsonString = match[1].trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            return JSON.parse(jsonString) as FinalDetailedOutline;
        } catch (e) {
            console.error("Failed to parse outline", e);
            return null;
        }
    }, [activeOutlineTitle, outlineHistory]);

    // Effect to detect parsing errors and show them in UI
    useEffect(() => {
        if (activeOutlineTitle && outlineHistory[activeOutlineTitle] && !parsedOutline) {
            setError(`解析章节 "${activeOutlineTitle}" 的细纲数据失败。数据可能已损坏，请尝试重新生成。`);
        }
    }, [activeOutlineTitle, outlineHistory, parsedOutline]);

    const isGenerating = !!generationStatus;

    const handleGenerateTitles = async () => {
        // Validation: Check if planning model is set
        if (!storyOptions.planningModel) {
            setError("未配置规划模型。请在“设置”中选择一个模型（建议使用 Flash 模型以获得更快的速度）。");
            return;
        }

        if (isMaxReached) {
            setError("已达到当前篇幅设定的最大章节数。请在设置中调整篇幅，或直接开始创作。");
            return;
        }

        setIsLoadingTitles(true);
        setError(null);
        setActiveOutlineTitle(null);
        try {
            const titles = await generateChapterTitles(storyOutline, chapters, storyOptions);
            // Strict enforcement: Truncate any extra titles if AI hallucinated more than requested
            // Calculate how many we can actually add
            const slotsAvailable = maxChapters - generatedTitles.length;
            const validTitles = titles.slice(0, slotsAvailable);
            
            setGeneratedTitles(prev => [...prev, ...validTitles]);
            
            if (titles.length > slotsAvailable) {
                // Optionally warn user that AI tried to generate too many
                console.warn(`AI generated ${titles.length} titles, but strict limit allowed only ${slotsAvailable}. Truncated.`);
            }

        } catch (e: any) {
            setError(e.message || "生成章节标题时发生未知错误。");
        } finally {
            setIsLoadingTitles(false);
        }
    };

    const handleGenerateAndCritique = async (optionalUserInput?: string) => {
        if (!activeOutlineTitle) return;

        // Validation: Check if planning model is set
        if (!storyOptions.planningModel) {
            setError("未配置规划模型。请在“设置”中选择一个模型（建议使用 Flash 模型以获得更快的速度）。");
            return;
        }

        setError(null);
        const ac = new AbortController();
        setController(ac);

        const isRefinement = !!parsedOutline;
        const currentVersion = (parsedOutline?.finalVersion || 0) + 1;
        let previousAttempt: { outline: DetailedOutlineAnalysis, critique: OutlineCritique } | null = null;
        
        if (isRefinement && parsedOutline) {
            const historyLen = parsedOutline.optimizationHistory.length;
            if (historyLen > 0) {
                const latestHistory = parsedOutline.optimizationHistory[historyLen - 1];
                previousAttempt = {
                    outline: latestHistory.outline,
                    critique: latestHistory.critique
                };
            }
        } else {
            // Clear previous result before starting a new one
            setOutlineHistory(prev => {
                const newHistory = {...prev};
                delete newHistory[activeOutlineTitle];
                return newHistory;
            });
        }
        
        try {
            // Step 1: Generate Outline
            setGenerationStatus(`v${currentVersion} - 正在生成初稿...`);
            const outlineResponse = await generateDetailedOutline(
                storyOutline, chapters, activeOutlineTitle, storyOptions,
                previousAttempt,
                optionalUserInput || userInput,
                ac.signal
            );
            const newOutline = outlineResponse.outline;

            // Step 2: Critique Outline
            setGenerationStatus(`v${currentVersion} - 正在评估稿件...`);
            const critiqueResponse = await critiqueDetailedOutline(
                newOutline, storyOutline, activeOutlineTitle, storyOptions, ac.signal
            );
            const newCritique = critiqueResponse.critique;

            // Step 3: Combine and save
            const newHistoryEntry: OptimizationHistoryEntry = {
                version: currentVersion,
                critique: newCritique,
                outline: newOutline
            };

            const finalOutline: FinalDetailedOutline = {
                ...newOutline,
                finalVersion: currentVersion,
                optimizationHistory: isRefinement && parsedOutline ? [...parsedOutline.optimizationHistory, newHistoryEntry] : [newHistoryEntry]
            };
            
            const resultString = `[START_DETAILED_OUTLINE_JSON]\n${JSON.stringify(finalOutline, null, 2)}\n[END_DETAILED_OUTLINE_JSON]`;
            setOutlineHistory(prev => ({ ...prev, [activeOutlineTitle]: resultString }));
            setUserInput(''); // Clear input after use

        } catch (e: any) {
            const errorMessage = e.message || "生成细纲时发生未知错误。";
             if (e.name === 'AbortError') {
                setError("操作已中止。");
            } else {
                setError(errorMessage);
            }
        } finally {
            setGenerationStatus(null);
            setController(null);
        }
    };

    const handleCopy = () => {
        if (!parsedOutline) return;
        const jsonString = JSON.stringify(parsedOutline, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            setError("复制失败: " + err.message);
        });
    };

    const handleToolboxRequest = async () => {
        if (!parsedOutline) {
            setToolboxError("无法使用工具，需要先生成一个有效的细纲。");
            return;
        }
        setIsToolboxLoading(true);
        setToolboxResult(null);
        setToolboxError(null);
        try {
            const detailedOutline: DetailedOutlineAnalysis = {
                plotPoints: parsedOutline.plotPoints,
                nextChapterPreview: parsedOutline.nextChapterPreview,
            };
            const response = await generateNarrativeToolboxSuggestions(detailedOutline, storyOutline, storyOptions);
            setToolboxResult(response.text);
        } catch (e: any) {
            setToolboxError(e.message || "获取建议时发生未知错误。");
        } finally {
            setIsToolboxLoading(false);
        }
    };

    const handleAdoptSuggestion = () => {
        if (!toolboxResult) return;
        const adoptionPrompt = `根据以下AI叙事医生的建议，对当前细纲进行一次迭代优化：\n\n---建议开始---\n${toolboxResult}\n---建议结束---`;
        handleGenerateAndCritique(adoptionPrompt);
    };

    const nextChapterStart = generatedTitles.length + 1;
    // Determine how many chapters to ask for (max 10, or up to the limit)
    const nextBatchSize = Math.min(10, remainingChapters);

    return (
        <div className="glass-card p-6 rounded-lg space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100">章节细纲分析器</h2>
                    <p className="text-slate-400 mt-1 text-sm">【创作-评估-优化】迭代循环。AI扮演叙事架构师，遵循“反套路”与“爽感”核心。</p>
                </div>
                <ModelBadge model={storyOptions.planningModel} />
            </div>
            
            <div className="border-t border-white/10 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-400">
                        当前进度: <span className={isMaxReached ? "text-red-400" : "text-sky-400"}>{currentChapterCount}</span> / {maxChapters} 章
                    </span>
                    {isMaxReached && <span className="text-xs font-bold text-red-500 bg-red-900/20 px-2 py-1 rounded">篇幅已达上限</span>}
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4 relative overflow-hidden">
                    <div 
                        className={`bg-gradient-to-r ${isMaxReached ? 'from-red-600 to-red-400' : 'from-teal-600 to-sky-400'} h-1.5 rounded-full transition-all duration-500`} 
                        style={{ width: `${Math.min(100, (currentChapterCount / maxChapters) * 100)}%` }}
                    ></div>
                </div>

                <button
                    onClick={handleGenerateTitles}
                    disabled={isGenerating || isLoadingTitles || isMaxReached}
                    className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 transition-transform transform hover:scale-105 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                    {isLoadingTitles ? <LoadingSpinner className="w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                    {isLoadingTitles 
                        ? '正在规划...' 
                        : isMaxReached 
                            ? '已完成规划 (篇幅上限)' 
                            : `规划接下来 ${nextBatchSize} 章标题 (${nextChapterStart}-${nextChapterStart + nextBatchSize - 1})`
                    }
                </button>
            </div>

            {generatedTitles.length > 0 && (
                <div className="border-t border-white/10 pt-4 space-y-3">
                     <h3 className="text-lg font-semibold text-slate-200">已生成标题列表 (点击选择)</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {generatedTitles.map((title, index) => (
                            <button 
                                key={index} 
                                onClick={() => { setActiveOutlineTitle(title); setError(null); }}
                                disabled={isGenerating}
                                className={`p-3 text-left rounded-md text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${activeOutlineTitle === title ? 'bg-teal-600 text-white font-semibold' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                            >
                                <span className="font-mono text-xs opacity-70 mr-2">{chapters.length + index + 1}.</span> {title}
                            </button>
                        ))}
                     </div>
                </div>
            )}

            {activeOutlineTitle && (
                <div className="border-t border-white/10 pt-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-slate-200">
                            {parsedOutline ? '细纲分析 / 优化' : '为'}<span className="text-teal-400 mx-1">“{activeOutlineTitle}”</span>生成细纲分析
                        </h3>
                         {parsedOutline && (
                            <div className="flex items-center gap-x-2">
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-x-2 px-3 py-1.5 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50"
                                    disabled={isCopied}
                                >
                                    <CopyIcon className="w-3.5 h-3.5"/>
                                    {isCopied ? '已复制!' : '复制分析'}
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className='p-4 rounded-lg bg-slate-900/50 space-y-4'>
                        <form onSubmit={(e) => { e.preventDefault(); handleGenerateAndCritique(); }} className="space-y-3">
                            <div>
                                <label htmlFor="outline-prompt" className="block text-xs font-medium text-slate-400 mb-1">
                                    {parsedOutline ? `优化 v${parsedOutline.finalVersion + 1} 指令 (可选)`: '初稿生成指令 (可选)'}
                                </label>
                                <textarea
                                    id="outline-prompt"
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    placeholder={parsedOutline ? "例如：让冲突更激烈一些，增加一个反转..." : "例如：引入一个新角色，从他的视角展开..."}
                                    rows={3}
                                    className="w-full p-2 bg-slate-800/70 border border-slate-700 rounded-lg text-slate-200 focus:ring-1 focus:ring-cyan-500 transition text-sm resize-y"
                                    disabled={isGenerating}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isGenerating}
                                className="w-full flex items-center justify-center px-4 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-500 transition-transform transform hover:scale-105 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? <LoadingSpinner className="w-5 h-5 mr-2"/> : <SparklesIcon className="w-5 h-5 mr-2" />}
                                {generationStatus ? generationStatus : (parsedOutline ? `生成优化稿 (v${parsedOutline.finalVersion + 1})` : '生成初稿 (v1)')}
                            </button>
                        </form>
                    </div>

                    {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}
                    
                    {parsedOutline && (
                        <div className="space-y-4">
                             <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-700 max-h-[60rem] overflow-y-auto space-y-6">
                                <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                                    <div className="flex items-center gap-x-3">
                                        <h4 className="text-xl font-bold text-slate-100">终版细纲 (v{parsedOutline.finalVersion})</h4>
                                        <span className="font-mono text-sm bg-green-900/50 text-green-300 px-3 py-1 rounded-full">
                                            评分: {parsedOutline.optimizationHistory[parsedOutline.optimizationHistory.length - 1]?.critique.overallScore.toFixed(1) || 'N/A'}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => onStartWriting(activeOutlineTitle, outlineHistory[activeOutlineTitle])}
                                        className="flex items-center gap-x-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 text-white font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105"
                                    >
                                        <FilePenIcon className="w-5 h-5"/>
                                        <span>✨ 开始创作本章正文</span>
                                    </button>
                                </div>
                                
                                {parsedOutline.plotPoints.map((point: PlotPointAnalysis, index: number) => (
                                    <div key={index} className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/50 space-y-3">
                                        <h4 className="text-base font-bold text-teal-300">【剧情点 {index + 1}】 {point.summary}</h4>
                                        <div className="pt-2 border-t border-slate-700/50 space-y-3">
                                            <AnalysisField label="情绪价值交付 (核心爽点)" value={point.emotionalPayoff} color="text-rose-400" />
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <AnalysisField label="情绪曲线任务" value={point.emotionalCurve} color="text-sky-400" />
                                                <AnalysisField label="节奏控制" value={point.pacingControl} color="text-cyan-400" />
                                                <AnalysisField label="角色动机 (马斯洛需求)" value={point.maslowsNeeds} color="text-amber-400" />
                                                <AnalysisField label="爽点/钩子设计" value={point.webNovelElements} color="text-pink-400" />
                                                <AnalysisField label="冲突来源" value={point.conflictSource} color="text-red-400" />
                                                <AnalysisField label="逻辑夯实 (合理性与铺垫)" value={point.logicSolidification} color="text-green-400" />
                                                <div className="md:col-span-2">
                                                  <AnalysisField label="“展示而非讲述”建议" value={point.showDontTell} color="text-indigo-400" />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <AnalysisField label="关键对话与潜台词 (冰山法则)" value={point.dialogueAndSubtext} color="text-purple-400" />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <AnalysisField label="情绪与互动强化 (冲突张力)" value={point.emotionAndInteraction} color="text-pink-400" />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <AnalysisField label="世界观一瞥 (冰山法则)" value={point.worldviewGlimpse} color="text-gray-400" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                
                                <div className="mt-4 p-4 rounded-lg bg-slate-900/50 border border-slate-800/50">
                                    <h4 className="text-lg font-bold text-fuchsia-400 mb-3">下一章衔接规划</h4>
                                    <div className="space-y-3">
                                        <AnalysisField label="细纲设想" value={parsedOutline.nextChapterPreview.nextOutlineIdea} color="text-fuchsia-400" />
                                        <AnalysisField label="登场角色需求" value={parsedOutline.nextChapterPreview.characterNeeds} color="text-fuchsia-400" />
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-slate-700">
                                    <OptimizationHistoryDisplay history={parsedOutline.optimizationHistory} />
                                </div>
                            </div>

                            <div className="p-4 bg-slate-900/50 rounded-lg space-y-3">
                                <h4 className="text-sm font-medium text-slate-300">AI 叙事工具箱</h4>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={handleToolboxRequest} disabled={!parsedOutline || isToolboxLoading} className="flex items-center gap-x-2 px-3 py-1.5 text-xs rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isToolboxLoading ? <LoadingSpinner className="w-3.5 h-3.5"/> : <SparklesIcon className="w-3.5 h-3.5"/>}
                                        <span>深度优化建议 (冰山法则 & 规则冲突)</span>
                                    </button>
                                </div>
                                {toolboxResult && (
                                    <div className="mt-3 p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg">
                                        <h5 className="font-bold text-indigo-300 mb-2">AI 创意启发</h5>
                                        <div className="text-slate-300 text-sm whitespace-pre-wrap prose prose-invert prose-sm prose-p:my-1.5" dangerouslySetInnerHTML={{ __html: toolboxResult.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-400">$1</strong>') }} />
                                        <button onClick={handleAdoptSuggestion} disabled={isGenerating} className="mt-3 flex items-center gap-x-2 px-3 py-1.5 text-xs rounded-md bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50">
                                            <SendIcon className="w-3.5 h-3.5"/>
                                            <span>采纳此建议并优化</span>
                                        </button>
                                    </div>
                                )}
                                {toolboxError && <p className="mt-2 text-xs text-red-400">{toolboxError}</p>}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OutlineGenerator;
