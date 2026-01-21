
import React, { useMemo } from 'react';
import type { GeneratedChapter, FinalDetailedOutline, PlotPointAnalysis, StoryOptions } from '../types';
import LoadingSpinner from './icons/LoadingSpinner';
import RefreshCwIcon from './icons/RefreshCwIcon';
import MagicWandIcon from './icons/MagicWandIcon';
import EditIcon from './icons/EditIcon';

interface WritingWorkbenchProps {
    chapter: GeneratedChapter;
    outlineJson: string | null;
    isGenerating: boolean;
    onRegenerate: () => void;
    onEdit: (newContent: string) => void;
    storyOptions: StoryOptions;
}

const OutlineCard: React.FC<{ point: PlotPointAnalysis; index: number }> = ({ point, index }) => (
    <div className="p-3 mb-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs space-y-2">
        <div className="flex justify-between items-start">
            <span className="font-bold text-teal-400 bg-teal-950/30 px-1.5 py-0.5 rounded uppercase tracking-wider">剧情点 {index + 1}</span>
            <span className="text-rose-300 font-semibold">{point.emotionalPayoff}</span>
        </div>
        <p className="text-slate-200 font-medium leading-relaxed">{point.summary}</p>
        
        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-700/30 text-slate-400">
            <div>
                <span className="text-slate-500 mr-1">⚡ 冲突:</span> {point.conflictSource}
            </div>
            {point.dialogueAndSubtext && (
                <div className="bg-slate-900/50 p-2 rounded border-l-2 border-purple-500/50">
                    <span className="text-purple-400 block mb-1">💬 关键对话/潜台词:</span>
                    {point.dialogueAndSubtext}
                </div>
            )}
            {point.showDontTell && (
                <div>
                    <span className="text-sky-500 mr-1">👁️ 画面感(Show):</span> {point.showDontTell}
                </div>
            )}
             {point.webNovelElements && (
                <div>
                    <span className="text-amber-500 mr-1">🔥 爽点:</span> {point.webNovelElements}
                </div>
            )}
        </div>
    </div>
);

const WritingWorkbench: React.FC<WritingWorkbenchProps> = ({ 
    chapter, 
    outlineJson, 
    isGenerating, 
    onRegenerate,
    onEdit,
    storyOptions
}) => {
    
    // Parse the outline JSON safely
    const detailedOutline = useMemo<FinalDetailedOutline | null>(() => {
        if (!outlineJson) return null;
        try {
            // Helper to clean Markdown wrappers if present
            const cleanJson = outlineJson.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            // Sometimes the json is wrapped in the prompt template's tags, handled in App.tsx but safety check here
            const startTag = '\\[START_DETAILED_OUTLINE_JSON\\]';
            const endTag = '\\[END_DETAILED_OUTLINE_JSON\\]';
            const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`);
            const match = cleanJson.match(regex);
            const jsonStr = match ? match[1] : cleanJson;
            
            return JSON.parse(jsonStr) as FinalDetailedOutline;
        } catch (e) {
            console.error("Workbench outline parse error", e);
            return null;
        }
    }, [outlineJson]);

    return (
        <div className="flex flex-col h-[85vh] bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <span className="text-teal-500">#{chapter.id}</span> {chapter.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                        {isGenerating ? 'AI正在根据左侧蓝图施工...' : `字数统计: ${chapter.content.length} 字`}
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onRegenerate}
                        disabled={isGenerating}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                        title="依据当前细纲重新生成本章"
                    >
                        {isGenerating ? <LoadingSpinner className="w-4 h-4"/> : <RefreshCwIcon className="w-4 h-4"/>}
                        <span>重写本章</span>
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-grow flex overflow-hidden">
                
                {/* Left Panel: The Blueprint (Outline) */}
                <div className="w-1/3 min-w-[300px] max-w-[450px] bg-slate-900/80 border-r border-slate-800 flex flex-col">
                    <div className="p-3 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                            <span className="w-2 h-2 rounded-full bg-teal-500 mr-2"></span>
                            创作蓝图 / 施工标准
                        </h3>
                    </div>
                    <div className="overflow-y-auto p-4 custom-scrollbar flex-grow">
                        {detailedOutline ? (
                            <div className="space-y-4">
                                {detailedOutline.plotPoints.map((point, idx) => (
                                    <OutlineCard key={idx} point={point} index={idx} />
                                ))}
                                <div className="p-3 bg-fuchsia-900/20 border border-fuchsia-800/50 rounded-lg mt-6">
                                    <h4 className="text-xs font-bold text-fuchsia-400 mb-2">⏭️ 下一章铺垫</h4>
                                    <p className="text-slate-300 text-xs">{detailedOutline.nextChapterPreview.characterNeeds}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                                <p>未检测到有效的细纲数据。</p>
                                <p className="text-xs mt-2">请先在“细纲”模块生成本章的详细规划。</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: The Canvas (Editor) */}
                <div className="flex-grow flex flex-col bg-slate-950 relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500/50 via-sky-500/50 to-transparent z-10 opacity-50"></div>
                    
                    <div className="flex-grow overflow-y-auto p-8 md:p-12 custom-scrollbar">
                        {chapter.preWritingThought && (
                            <div className="mb-8 p-4 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-400 font-mono whitespace-pre-wrap">
                                <div className="font-bold text-slate-300 mb-2 border-b border-slate-700 pb-1">AI 思考回路 (Thought Process)</div>
                                {chapter.preWritingThought}
                            </div>
                        )}
                        
                        <div className="prose prose-invert prose-lg max-w-none prose-p:leading-8 prose-p:text-slate-300 prose-p:mb-6 font-serif">
                            {chapter.content ? (
                                chapter.content.split('\n').map((para, i) => para.trim() ? <p key={i}>{para}</p> : <br key={i}/>)
                            ) : (
                                <div className="flex items-center justify-center h-40 text-slate-600 italic">
                                    等待创作指令...
                                </div>
                            )}
                            {isGenerating && (
                                <div className="flex items-center gap-2 text-teal-400 mt-4 animate-pulse">
                                    <span className="w-2 h-4 bg-teal-400 block"></span>
                                    <span>正在输入...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WritingWorkbench;
