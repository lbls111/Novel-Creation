
import React, { useState, useEffect } from 'react';
import type { CharacterProfile, StoryOutline, StoryOptions, CustomField } from '../types';
import { generateCharacterInteractionStream, generateNewCharacterProfile, generateCharacterArcSuggestions } from '../services/geminiService';
import LoadingSpinner from './icons/LoadingSpinner';
import UsersRoundIcon from './icons/UsersRoundIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import EditIcon from './icons/EditIcon';
import TrashIcon from './icons/TrashIcon';
import SparklesIcon from './icons/SparklesIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import ThoughtProcessVisualizer from './ThoughtProcessVisualizer';


interface CharacterArchiveProps {
  storyOutline: StoryOutline;
  onUpdate: (updates: Partial<StoryOutline>) => void;
  storyOptions: StoryOptions;
}

const ModelBadge: React.FC<{ model: string }> = ({ model }) => (
    <div className="flex items-center gap-x-1.5 px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/50">
        <BrainCircuitIcon className="w-3.5 h-3.5 text-teal-400" />
        <span className="text-xs font-mono text-slate-400">模型: <span className="text-teal-300 font-semibold">{model || '未配置'}</span></span>
    </div>
);

const CharacterField: React.FC<{ label: string; value: any }> = ({ label, value }) => {
    if (value === undefined || value === null || value === '') return null;
    
    const displayValue = (typeof value === 'object') 
        ? JSON.stringify(value, null, 2) 
        : String(value);

    return (
        <div className="py-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
            <p className="text-slate-200 whitespace-pre-wrap">{displayValue}</p>
        </div>
    );
};

const CharacterEditField: React.FC<{ 
    label: string; 
    name: keyof CharacterProfile;
    value: string;
    onChange: (name: keyof CharacterProfile, value: string) => void;
    isTextarea?: boolean;
}> = ({ label, name, value, onChange, isTextarea }) => (
    <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
        {isTextarea ? (
            <textarea 
                name={name}
                value={value}
                onChange={e => onChange(name, e.target.value)}
                rows={3}
                className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm resize-y focus:ring-1 focus:ring-sky-500"
            />
        ) : (
            <input
                type="text"
                name={name}
                value={value}
                onChange={e => onChange(name, e.target.value)}
                className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm focus:ring-1 focus:ring-sky-500"
            />
        )}
    </div>
);

// New component for AI suggestions
const AISuggestionBlock: React.FC<{
    character: CharacterProfile;
    storyOutline: StoryOutline;
    storyOptions: StoryOptions;
}> = ({ character, storyOutline, storyOptions }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [thought, setThought] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGetSuggestion = async () => {
        setIsLoading(true);
        setSuggestion(null);
        setThought(null);
        setError(null);
        try {
            const response = await generateCharacterArcSuggestions(character, storyOutline, storyOptions);
            const rawText = response.text;
            const suggestionMarker = '### 建议';
            
            const suggestionIndex = rawText.indexOf(suggestionMarker);
            
            if (suggestionIndex !== -1) {
                setThought(rawText.substring(0, suggestionIndex).replace('### 思考过程', '').trim());
                setSuggestion(rawText.substring(suggestionIndex).replace(suggestionMarker, '').trim());
            } else {
                setSuggestion(rawText);
                 setThought(null);
            }

        } catch (e: any) {
            setError(e.message || "获取建议时发生未知错误。");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="col-span-full mt-4 pt-4 border-t border-slate-700/50 space-y-3">
            <button
                onClick={handleGetSuggestion}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 transition-colors shadow-md disabled:bg-slate-600"
            >
                {isLoading ? <LoadingSpinner className="w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                {isLoading ? '正在分析角色...' : 'AI 深化角色 (动机与弧光)'}
            </button>
            {thought && <ThoughtProcessVisualizer text={thought} />}
            {suggestion && (
                <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg">
                    <h4 className="font-bold text-indigo-300 mb-2">AI 角色深化建议</h4>
                    <div className="text-slate-300 text-sm whitespace-pre-wrap prose prose-invert prose-sm prose-p:my-1.5">
                        {suggestion}
                    </div>
                </div>
            )}
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
    );
};


const CharacterArchive: React.FC<CharacterArchiveProps> = ({ storyOutline, onUpdate, storyOptions }) => {
  const { characters } = storyOutline;
  const [selected, setSelected] = useState<number[]>([]);
  const [interactionScene, setInteractionScene] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<'interaction' | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<CharacterProfile | null>(null);
  const [newCustomFieldKey, setNewCustomFieldKey] = useState('');
  const [newCustomFieldValue, setNewCustomFieldValue] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCharacterPrompt, setNewCharacterPrompt] = useState('');

  if (!characters) {
    return <div className="p-6 text-center text-slate-400">角色档案为空。AI代理可能未能成功生成角色信息。</div>;
  }
  
  useEffect(() => {
    // If characters change from parent, clear selection
    setSelected([]);
    setInteractionScene(null);
  }, [characters]);


  const handleSelect = (index: number) => {
    if (editingIndex !== null) return; // Disable selection during edit
    setInteractionScene(null);
    setSelected(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      if (prev.length < 2) {
        return [...prev, index];
      }
      return [prev[0], index];
    });
  };

  const handleGenerateInteraction = async () => {
    if (selected.length !== 2) return;
    
    setIsLoading('interaction');
    setError(null);
    setInteractionScene('');

    const [char1, char2] = [characters[selected[0]], characters[selected[1]]];

    try {
        const stream = await generateCharacterInteractionStream(char1, char2, storyOutline, storyOptions);
        let sceneText = "";
        for await (const chunk of stream) {
            if (chunk.error) {
                throw new Error(chunk.error);
            }
            if (chunk.text) {
                sceneText += chunk.text;
                setInteractionScene(sceneText);
            }
        }
    } catch (e: any) {
        setError(e.message || "生成互动场景时发生未知错误。");
        setInteractionScene(null);
    } finally {
        setIsLoading(null);
    }
  };

  const handleDelete = (index: number) => {
    if (window.confirm(`确定要删除角色“${characters[index].name}”吗？此操作不可撤销。`)) {
        const newCharacters = characters.filter((_, i) => i !== index);
        onUpdate({ characters: newCharacters });
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditingData({ ...characters[index] });
    setSelected([]); // Clear selections
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingData(null);
    setNewCustomFieldKey('');
    setNewCustomFieldValue('');
  };
  
  const handleEditChange = (name: keyof CharacterProfile, value: string) => {
    if (editingData) {
      setEditingData(prev => ({ ...prev!, [name]: value }));
    }
  };

  const handleCustomFieldChange = (index: number, key: string, value: string) => {
    if (editingData) {
        const updatedFields = [...(editingData.customFields || [])];
        updatedFields[index] = { key, value };
        setEditingData(prev => ({ ...prev!, customFields: updatedFields }));
    }
  };

  const addCustomField = () => {
      if (editingData && newCustomFieldKey.trim() && newCustomFieldValue.trim()) {
          const newField: CustomField = { key: newCustomFieldKey.trim(), value: newCustomFieldValue.trim() };
          const updatedFields = [...(editingData.customFields || []), newField];
          setEditingData(prev => ({...prev!, customFields: updatedFields}));
          setNewCustomFieldKey('');
          setNewCustomFieldValue('');
      }
  };

  const deleteCustomField = (index: number) => {
      if (editingData) {
          const updatedFields = (editingData.customFields || []).filter((_, i) => i !== index);
          setEditingData(prev => ({...prev!, customFields: updatedFields}));
      }
  };


  const saveEditing = () => {
    if (editingIndex === null || !editingData) return;
    const newCharacters = [...characters];
    newCharacters[editingIndex] = editingData;
    onUpdate({ characters: newCharacters });
    cancelEditing();
  };

  const handleGenerateNewCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharacterPrompt.trim()) return;

    setIsLoading('new');
    setError(null);
    try {
        const response = await generateNewCharacterProfile(storyOutline, newCharacterPrompt, storyOptions);
        const newChar = JSON.parse(response.text) as CharacterProfile;
        onUpdate({ characters: [...characters, newChar] });
        setShowAddForm(false);
        setNewCharacterPrompt('');
    } catch (e: any) {
        setError(e.message || '生成新角色失败。');
    } finally {
        setIsLoading(null);
    }
  };

  return (
    <div className="space-y-4 p-1">
        <div className="glass-card p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-100">角色管理</h3>
                <ModelBadge model={storyOptions.planningModel} />
            </div>

            {!showAddForm ? (
                <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center p-3 text-sm font-semibold text-slate-200 bg-slate-700/50 hover:bg-slate-700/80 rounded-lg transition-colors">
                    <PlusCircleIcon className="w-5 h-5 mr-2 text-green-400"/>
                    生成新角色
                </button>
            ) : (
                <form onSubmit={handleGenerateNewCharacter} className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-300">生成新角色</h3>
                    <div>
                        <label htmlFor="new-char-prompt" className="block text-sm text-slate-400 mb-1">输入新角色概念：</label>
                        <input
                            id="new-char-prompt"
                            type="text"
                            value={newCharacterPrompt}
                            onChange={(e) => setNewCharacterPrompt(e.target.value)}
                            placeholder="输入新角色的核心概念..."
                            className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm focus:ring-1 focus:ring-sky-500"
                            disabled={isLoading === 'new'}
                        />
                    </div>
                    <div className="flex items-center gap-x-2">
                        <button type="submit" className="flex-grow flex items-center justify-center px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors shadow-md disabled:bg-slate-600" disabled={isLoading === 'new'}>
                           {isLoading === 'new' ? <LoadingSpinner className="w-5 h-5 mr-2"/> : <SparklesIcon className="w-5 h-5 mr-2" />}
                           {isLoading === 'new' ? '生成中...' : '生成'}
                        </button>
                        <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-500 transition-colors" disabled={isLoading === 'new'}>
                            取消
                        </button>
                    </div>
                </form>
            )}
        </div>


        {selected.length === 2 && (
            <div className="glass-card p-4 rounded-lg sticky top-2 z-10">
                 <p className="text-sm text-slate-300 mb-2">已选择: <span className="font-bold text-sky-300">{characters[selected[0]].name}</span> & <span className="font-bold text-sky-300">{characters[selected[1]].name}</span></p>
                 <button 
                    onClick={handleGenerateInteraction}
                    disabled={isLoading === 'interaction'}
                    className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 transition-transform transform hover:scale-105 shadow-lg disabled:bg-slate-600 disabled:cursor-not-allowed"
                 >
                    {isLoading === 'interaction' ? <LoadingSpinner className="w-5 h-5 mr-2"/> : <UsersRoundIcon className="w-5 h-5 mr-2"/>}
                    {isLoading === 'interaction' ? '正在生成...' : '生成互动场景'}
                 </button>
            </div>
        )}

        {interactionScene !== null && (
            <div className="glass-card p-4 rounded-lg">
                <h3 className="text-lg font-bold text-teal-300 mb-2">互动场景</h3>
                <div className="text-slate-300 whitespace-pre-wrap font-serif leading-relaxed text-sm prose prose-invert prose-p:mb-2">
                    {interactionScene}
                    {isLoading === 'interaction' && <span className="inline-block w-2 h-4 bg-slate-300 animate-pulse ml-1" />}
                </div>
            </div>
        )}

        {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}

      {characters.map((char, index) => (
        <div 
            key={index} 
            className={`glass-card rounded-lg overflow-hidden transition-all duration-300 border-2 ${selected.includes(index) ? 'border-teal-500' : 'border-transparent'} ${editingIndex === index ? 'border-sky-500' : ''}`}
            onClick={() => handleSelect(index)}
        >
        {editingIndex === index && editingData ? (
             <div className="p-4 space-y-4">
                <h3 className="text-xl font-bold text-sky-300">编辑角色: {editingData.name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CharacterEditField label="姓名" name="name" value={editingData.name} onChange={handleEditChange} />
                    <CharacterEditField label="角色定位" name="role" value={editingData.role} onChange={handleEditChange} />
                    <div className="md:col-span-2"><CharacterEditField label="核心概念" name="coreConcept" value={editingData.coreConcept} onChange={handleEditChange} isTextarea /></div>
                    <CharacterEditField label="标志性物品" name="definingObject" value={editingData.definingObject} onChange={handleEditChange} />
                    <CharacterEditField label="物理特征" name="physicalAppearance" value={editingData.physicalAppearance} onChange={handleEditChange} isTextarea/>
                    <CharacterEditField label="行为怪癖" name="behavioralQuirks" value={editingData.behavioralQuirks} onChange={handleEditChange} isTextarea/>
                    <CharacterEditField label="语言模式" name="speechPattern" value={editingData.speechPattern} onChange={handleEditChange} isTextarea/>
                    <div className="md:col-span-2"><CharacterEditField label="起源片段" name="originFragment" value={editingData.originFragment} onChange={handleEditChange} isTextarea/></div>
                    <div className="md:col-span-2"><CharacterEditField label="隐秘负担" name="hiddenBurden" value={editingData.hiddenBurden} onChange={handleEditChange} isTextarea/></div>
                    <CharacterEditField label="即时目标" name="immediateGoal" value={editingData.immediateGoal} onChange={handleEditChange} />
                    <CharacterEditField label="长期野心" name="longTermAmbition" value={editingData.longTermAmbition} onChange={handleEditChange} />
                    <CharacterEditField label="赌注" name="whatTheyRisk" value={editingData.whatTheyRisk} onChange={handleEditChange} />
                    <CharacterEditField label="关键人际关系" name="keyRelationship" value={editingData.keyRelationship} onChange={handleEditChange} />
                    <CharacterEditField label="主要对手" name="mainAntagonist" value={editingData.mainAntagonist} onChange={handleEditChange} />
                    <div className="md:col-span-2"><CharacterEditField label="故事功能" name="storyFunction" value={editingData.storyFunction} onChange={handleEditChange} isTextarea/></div>
                    <div className="md:col-span-2"><CharacterEditField label="潜在变化" name="potentialChange" value={editingData.potentialChange} onChange={handleEditChange} isTextarea/></div>
                </div>
                
                 <div className="pt-4 border-t border-slate-700">
                    <h4 className="text-base font-semibold text-slate-300 mb-2">自定义字段</h4>
                    {(editingData.customFields || []).map((field, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                            <input type="text" value={field.key} onChange={e => handleCustomFieldChange(idx, e.target.value, field.value)} className="w-1/3 p-1.5 bg-slate-700 border border-slate-600 rounded-md text-slate-200 text-sm" />
                            <input type="text" value={field.value} onChange={e => handleCustomFieldChange(idx, field.key, e.target.value)} className="flex-grow p-1.5 bg-slate-700 border border-slate-600 rounded-md text-slate-200 text-sm" />
                            <button onClick={() => deleteCustomField(idx)} className="p-1.5 rounded-full hover:bg-red-800/50"><TrashIcon className="w-4 h-4 text-red-400"/></button>
                        </div>
                    ))}
                     <div className="flex items-center gap-2 mt-3">
                        <input type="text" value={newCustomFieldKey} onChange={e => setNewCustomFieldKey(e.target.value)} placeholder="字段名" className="w-1/3 p-1.5 bg-slate-900 border border-slate-600 rounded-md text-slate-200 text-sm" />
                        <input type="text" value={newCustomFieldValue} onChange={e => setNewCustomFieldValue(e.target.value)} placeholder="字段值" className="flex-grow p-1.5 bg-slate-900 border border-slate-600 rounded-md text-slate-200 text-sm" />
                        <button type="button" onClick={addCustomField} className="p-1.5 rounded-full bg-green-600 hover:bg-green-500"><PlusCircleIcon className="w-5 h-5 text-white"/></button>
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
                    <button onClick={saveEditing} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm font-semibold">保存</button>
                    <button onClick={cancelEditing} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-sm font-semibold">取消</button>
                </div>
             </div>
        ) : (
            <details className="w-full" open={char.role === '核心' || char.role === '主角'}>
                <summary className="p-4 flex justify-between items-center bg-slate-900/50 hover:bg-slate-800/50 list-none cursor-pointer">
                    <div className="flex-grow">
                        <h3 className="text-xl font-bold text-sky-300">{char.name}</h3>
                        <p className="text-slate-400 text-sm mt-1">{char.coreConcept}</p>
                    </div>
                    <div className="flex items-center flex-shrink-0 ml-4 gap-x-2">
                        <span className="text-xs font-mono bg-slate-700/50 text-amber-300 px-2 py-1 rounded-full">{char.role}</span>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(index); }} className="p-1.5 rounded-full hover:bg-slate-700" title="编辑角色"><EditIcon className="w-4 h-4 text-slate-400"/></button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(index); }} className="p-1.5 rounded-full hover:bg-slate-700" title="删除角色"><TrashIcon className="w-4 h-4 text-slate-400"/></button>
                    </div>
                </summary>
                <div className="p-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 bg-slate-900/20">
                    <div className="lg:col-span-3"><CharacterField label="物理特征 (Observable)" value={char.physicalAppearance} /></div>
                    <div className="md:col-span-1"><CharacterField label="行为怪癖 (Quirks)" value={char.behavioralQuirks} /></div>
                    <div className="md:col-span-2"><CharacterField label="语言模式 (Speech)" value={char.speechPattern} /></div>
                    
                    <div className="col-span-full mt-2 pt-2 border-t border-slate-700/50">
                        <CharacterField label="标志性物品 (Object)" value={char.definingObject} />
                    </div>
                    <div className="col-span-full">
                        <CharacterField label="起源片段 (Origin Event)" value={char.originFragment} />
                    </div>
                    <div className="col-span-full">
                        <CharacterField label="隐秘负担 (Burden)" value={char.hiddenBurden} />
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-700/50"><CharacterField label="即时目标 (Goal)" value={char.immediateGoal} /></div>
                    <div className="mt-2 pt-2 border-t border-slate-700/50"><CharacterField label="长期野心 (Ambition)" value={char.longTermAmbition} /></div>
                    <div className="mt-2 pt-2 border-t border-slate-700/50"><CharacterField label="赌注 (Stakes)" value={char.whatTheyRisk} /></div>
                    
                    <div className="col-span-full mt-2 pt-2 border-t border-slate-700/50">
                        <CharacterField label="关键人际关系 (Relationship)" value={char.keyRelationship} />
                    </div>
                    <div className="col-span-full">
                        <CharacterField label="主要对手 (Antagonist)" value={char.mainAntagonist} />
                    </div>

                    <div className="col-span-full mt-2 pt-2 border-t border-slate-700/50">
                        <CharacterField label="故事功能 (Function)" value={char.storyFunction} />
                    </div>
                    <div className="col-span-full">
                        <CharacterField label="潜在变化 (Potential Arc)" value={char.potentialChange} />
                    </div>
                     {char.customFields && char.customFields.length > 0 && (
                        <div className="col-span-full mt-2 pt-2 border-t border-slate-700/50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                           {char.customFields.map(field => (
                               <CharacterField key={field.key} label={field.key} value={field.value} />
                           ))}
                        </div>
                    )}
                    <AISuggestionBlock
                        character={char}
                        storyOutline={storyOutline}
                        storyOptions={storyOptions}
                    />
                </div>
            </details>
        )}
        </div>
      ))}
    </div>
  );
};

export default CharacterArchive;
