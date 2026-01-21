
import React, { useState } from 'react';
import type { StoryOutline, WorldEntry, WorldCategory, StoryOptions } from '../types';
import EditIcon from './icons/EditIcon';
import TrashIcon from './icons/TrashIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import SparklesIcon from './icons/SparklesIcon';
import LoadingSpinner from './icons/LoadingSpinner';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import { generateWorldbookSuggestions } from '../services/geminiService';
import ThoughtProcessVisualizer from './ThoughtProcessVisualizer';

interface WorldbookEditorProps {
    storyOutline: StoryOutline;
    onUpdate: (updates: Partial<StoryOutline>) => void;
    storyOptions: StoryOptions; // Added for API call
}

const ModelBadge: React.FC<{ model: string }> = ({ model }) => (
    <div className="flex items-center gap-x-1.5 px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/50">
        <BrainCircuitIcon className="w-3.5 h-3.5 text-teal-400" />
        <span className="text-xs font-mono text-slate-400">模型: <span className="text-teal-300 font-semibold">{model || '未配置'}</span></span>
    </div>
);

const WorldbookEditor: React.FC<WorldbookEditorProps> = ({ storyOutline, onUpdate, storyOptions }) => {
    const [categories, setCategories] = useState<WorldCategory[]>(storyOutline.worldCategories || []);
    
    // State for adding new entries
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);

    // State for adding new category
    const [newCategoryName, setNewCategoryName] = useState('');
    
    // State for editing entries
    const [editingEntry, setEditingEntry] = useState<{catIndex: number, entryIndex: number} | null>(null);
    const [editKey, setEditKey] = useState('');
    const [editValue, setEditValue] = useState('');

    // State for editing synopsis
    const [isEditingSynopsis, setIsEditingSynopsis] = useState(false);
    const [editedSynopsis, setEditedSynopsis] = useState(storyOutline.plotSynopsis);

    // State for AI suggestions
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<string | null>(null);
    const [thought, setThought] = useState<string | null>(null);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);


    const handleUpdateCategories = (newCategories: WorldCategory[]) => {
        setCategories(newCategories);
        onUpdate({ worldCategories: newCategories });
    };

    const handleAddCategory = () => {
        if(newCategoryName.trim()) {
            const newCategories = [...categories, { name: newCategoryName.trim(), entries: [] }];
            handleUpdateCategories(newCategories);
            setNewCategoryName('');
        }
    };
    
    const handleDeleteCategory = (catIndex: number) => {
        if(window.confirm(`确定要删除分类 "${categories[catIndex].name}" 及其所有条目吗？`)) {
            const newCategories = categories.filter((_, i) => i !== catIndex);
            handleUpdateCategories(newCategories);
        }
    };
    
    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (newKey.trim() && newValue.trim() && categories[selectedCategoryIndex]) {
            const newCategories = [...categories];
            newCategories[selectedCategoryIndex].entries.push({ key: newKey.trim(), value: newValue.trim() });
            handleUpdateCategories(newCategories);
            setNewKey('');
            setNewValue('');
        }
    };
    
    const handleDeleteEntry = (catIndex: number, entryIndex: number) => {
        const newCategories = [...categories];
        newCategories[catIndex].entries = newCategories[catIndex].entries.filter((_, i) => i !== entryIndex);
        handleUpdateCategories(newCategories);
    };

    const startEditingEntry = (catIndex: number, entryIndex: number) => {
        setEditingEntry({ catIndex, entryIndex });
        setEditKey(categories[catIndex].entries[entryIndex].key);
        setEditValue(categories[catIndex].entries[entryIndex].value);
    };

    const handleUpdateEntry = () => {
        if (editingEntry && editKey.trim() && editValue.trim()) {
            const {catIndex, entryIndex} = editingEntry;
            const newCategories = [...categories];
            newCategories[catIndex].entries[entryIndex] = { key: editKey.trim(), value: editValue.trim() };
            handleUpdateCategories(newCategories);
            setEditingEntry(null);
        }
    };

    const handleSaveSynopsis = () => {
        onUpdate({ plotSynopsis: editedSynopsis });
        setIsEditingSynopsis(false);
    };
    
    const handleGetSuggestions = async () => {
        setIsGeneratingSuggestions(true);
        setSuggestions(null);
        setThought(null);
        setSuggestionError(null);
        try {
            const response = await generateWorldbookSuggestions(storyOutline, storyOptions);
            const rawText = response.text;
            const suggestionMarker = '### 建议';

            const suggestionIndex = rawText.indexOf(suggestionMarker);
            
            if (suggestionIndex !== -1) {
                setThought(rawText.substring(0, suggestionIndex).replace('### 思考过程', '').trim());
                setSuggestions(rawText.substring(suggestionIndex).replace(suggestionMarker, '').trim());
            } else {
                setSuggestions(rawText);
                setThought(null);
            }
        } catch (e: any) {
            setSuggestionError(e.message || "获取建议失败。");
        } finally {
            setIsGeneratingSuggestions(false);
        }
    };


    return (
        <div className="glass-card p-6 rounded-lg space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-100">世界书 / Worldbook</h2>
                    <p className="text-slate-400 mt-1 text-sm">管理故事的核心设定。越详细的设定能保证AI创作的一致性。</p>
                </div>
                <ModelBadge model={storyOptions.planningModel} />
            </div>

            <div className="border-t border-white/10 pt-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-teal-300">剧情总纲</h3>
                    {!isEditingSynopsis && (
                        <button onClick={() => setIsEditingSynopsis(true)} className="flex items-center gap-x-1 text-sm text-slate-400 hover:text-sky-400 transition-colors">
                            <EditIcon className="w-4 h-4"/>
                            编辑
                        </button>
                    )}
                </div>
                {isEditingSynopsis ? (
                    <div className='space-y-2'>
                        <textarea 
                            value={editedSynopsis}
                            onChange={(e) => setEditedSynopsis(e.target.value)}
                            rows={6}
                            className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-slate-300 resize-y"
                        />
                        <div className="flex items-center gap-2">
                            <button onClick={handleSaveSynopsis} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm">保存</button>
                            <button onClick={() => { setIsEditingSynopsis(false); setEditedSynopsis(storyOutline.plotSynopsis); }} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-sm">取消</button>
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-300 whitespace-pre-wrap">{storyOutline.plotSynopsis}</p>
                )}
            </div>
            
            <div className="border-t border-white/10 pt-4 space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-sky-300">世界观条目</h3>
                    <button onClick={handleGetSuggestions} disabled={isGeneratingSuggestions} className="flex items-center gap-x-2 px-3 py-1.5 text-xs rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
                        {isGeneratingSuggestions ? <LoadingSpinner className="w-3.5 h-3.5"/> : <SparklesIcon className="w-3.5 h-3.5"/>}
                        <span>{isGeneratingSuggestions ? "思考中..." : "AI 深化建议"}</span>
                    </button>
                </div>
                 
                {thought && (
                    <div className="space-y-3">
                        <ThoughtProcessVisualizer text={thought} />
                    </div>
                )}
                
                {suggestions && (
                    <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-lg">
                        <h4 className="font-bold text-indigo-300 mb-2">AI 创意启发</h4>
                        <div className="text-slate-300 text-sm whitespace-pre-wrap prose prose-invert prose-sm prose-p:my-1.5">
                           {suggestions}
                        </div>
                    </div>
                )}
                {suggestionError && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{suggestionError}</p>}
                
                {categories.map((category, catIndex) => (
                    <details key={catIndex} className="bg-slate-950/40 rounded-lg border border-slate-700/50" open>
                        <summary className="p-3 cursor-pointer font-semibold text-slate-200 flex justify-between items-center">
                            <span>{category.name}</span>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCategory(catIndex); }} className="p-1.5 rounded-full hover:bg-slate-700" title="删除分类"><TrashIcon className="w-4 h-4 text-slate-400"/></button>
                        </summary>
                        <div className="p-4 border-t border-slate-700/50 space-y-3">
                            {category.entries.map((entry, entryIndex) => (
                                <div key={entryIndex} className="bg-slate-900/50 p-3 rounded-lg">
                                    {editingEntry?.catIndex === catIndex && editingEntry?.entryIndex === entryIndex ? (
                                        <div className="space-y-2">
                                            <input type="text" value={editKey} onChange={(e) => setEditKey(e.target.value)} className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 font-bold" />
                                            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-slate-300 resize-y" />
                                            <div className="flex items-center gap-2">
                                                <button onClick={handleUpdateEntry} className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm">保存</button>
                                                <button onClick={() => setEditingEntry(null)} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-sm">取消</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <p className="font-bold text-slate-100">{entry.key}</p>
                                                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                    <button onClick={() => startEditingEntry(catIndex, entryIndex)} className="text-slate-400 hover:text-sky-400 text-xs">编辑</button>
                                                    <button onClick={() => handleDeleteEntry(catIndex, entryIndex)} className="text-slate-400 hover:text-red-400 text-xs">删除</button>
                                                </div>
                                            </div>
                                            <p className="text-slate-300 mt-1 whitespace-pre-wrap text-sm">{entry.value}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {category.entries.length === 0 && <p className="text-slate-500 text-sm text-center py-2">此分类下暂无条目。</p>}
                        </div>
                    </details>
                ))}
                
                <div className="p-3 bg-slate-900/30 rounded-lg flex items-center gap-2">
                     <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="新分类名称..."
                        className="flex-grow p-2 bg-slate-800/70 border border-slate-700 rounded-lg text-slate-200"
                    />
                    <button onClick={handleAddCategory} className="p-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors flex-shrink-0">
                        <PlusCircleIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>

            <form onSubmit={handleAddEntry} className="border-t border-white/10 pt-4 space-y-3">
                 <h3 className="text-lg font-semibold text-green-400/90 mb-2">新增条目</h3>
                 <div>
                    <label htmlFor="category-select" className="block text-sm font-medium text-slate-400 mb-1">选择分类</label>
                    <select id="category-select" value={selectedCategoryIndex} onChange={e => setSelectedCategoryIndex(Number(e.target.value))} className="w-full p-2 bg-slate-800/70 border border-slate-700 rounded-lg text-slate-200">
                        {categories.map((cat, index) => (
                            <option key={index} value={index}>{cat.name}</option>
                        ))}
                    </select>
                 </div>
                 <div>
                    <label htmlFor="new-key" className="block text-sm font-medium text-slate-400 mb-1">关键词 (Key)</label>
                    <input
                        id="new-key"
                        type="text"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        placeholder="输入关键词..."
                        className="w-full p-2 bg-slate-800/70 border border-slate-700 rounded-lg text-slate-200"
                    />
                 </div>
                 <div>
                    <label htmlFor="new-value" className="block text-sm font-medium text-slate-400 mb-1">描述 (Value)</label>
                    <textarea
                        id="new-value"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        rows={4}
                        placeholder="对此关键词的详细描述。AI在写作时会严格遵守此设定。"
                        className="w-full p-2 bg-slate-800/70 border border-slate-700 rounded-lg text-slate-200 resize-y"
                    />
                 </div>
                 <button type="submit" className="px-5 py-2 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors" disabled={categories.length === 0}>
                    添加条目
                 </button>
            </form>
        </div>
    );
};

export default WorldbookEditor;
