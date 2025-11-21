import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine, ComposedChart
} from 'recharts';
import {
    Upload, Filter, Package, Calendar, ChevronDown, Search, Clock, ToggleLeft, ToggleRight, AlertTriangle, X, Table, SlidersHorizontal, ArrowUpDown, CheckSquare, Square, Activity, Layers, Factory, Network, FileSpreadsheet, ArrowRight, Warehouse, Box, ArrowLeftRight, MapPin, RefreshCw, RotateCcw, PanelLeft, Sun, Moon, MoreHorizontal
} from 'lucide-react';

// --- CONFIGURATION ---
const GOOGLE_SHEET_CONFIG = {
    INVENTORY_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSe_LVLpnR6g1hDB3e9iulTyW6H-GZaDr0RbmOf0_ePIFcS8XnKFngsdZHKy_i4YSLpdLe6BMPAO9Av/pub?gid=1666488360&single=true&output=csv", 
    BOM_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwON2WzEI596aLH7oCBzoawdIL1TufE-Ta8GWpsj_D3xQOVggZMsFEl_l4pFzeFmvLPAbyS2AWSghV/pub?gid=106702660&single=true&output=csv"        
};

const PLANT_ORGS = ['THRYPM', 'MYBGPM'];
const DC_ORGS = ['THBNDM', 'VNHCDM', 'VNHNDM', 'IDCKDM', 'PHPSDM'];

// --- Helper for CSV Parsing ---
const parseCSV = (csvText) => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');
        if (currentLine.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                let value = currentLine[index].trim().replace(/^"|"$/g, '');
                if (!isNaN(value) && value !== '' && (header === 'Value' || header.includes('Qty') || header.includes('Ratio') || header.includes('Quantity'))) {
                    value = parseFloat(value);
                }
                row[header] = value;
            });
            if (row.Date) {
                const d = new Date(row.Date);
                if (!isNaN(d.getTime())) row._dateObj = d;
            }
            if (row.Metric) row.Metric = row.Metric.trim();
            data.push(row);
        }
    }
    return data;
};

const toInputDate = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    return dateObj.toISOString().split('T')[0];
};

const addWeeks = (date, weeks) => {
    const result = new Date(date);
    result.setDate(result.getDate() + (weeks * 7));
    return result;
};

const getLeadTimeWeeks = (invOrg) => {
    if (invOrg === 'IDCKDM') return 6;
    if (invOrg === 'VNHCDM' || invOrg === 'VNHNDM') return 7;
    if (invOrg === 'THBNDM' || invOrg === 'MYBGPM') return 5;
    return 4;
};

// --- Sample Data ---
const SAMPLE_CSV = `Factory,Type,Item Code,Inv Org,Item Class,UOM,Strategy,Original Item String,Metric,Start,Date,Value
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/19/2025,9910.16
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/19/2025,5000.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Target Inv.,0,11/19/2025,4000.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/20/2025,500.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/20/2025,400.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Target Inv.,0,11/20/2025,4000.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Req.,0,11/21/2025,0
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Inventory (Forecast),0,11/21/2025,-400.00
SF,FG,AAG620-MR2,MYBGPM,MR,LM,MTS,AAG620-MR2/MYBGPM/MR/LM/MTS,Tot.Target Inv.,0,11/21/2025,4000.00
SF,RM,BAB250-MR1,MYBGPM,FA,KG,MTS,BAB250-MR1/MYBGPM/FA/KG/MTS,Tot.Inventory (Forecast),0,11/19/2025,2500.00
SF,RM,BAB250-MR1,MYBGPM,FA,KG,MTS,BAB250-MR1/MYBGPM/FA/KG/MTS,Tot.Target Inv.,0,11/19/2025,3000.00
SF,RM,BAB250-MR1,MYBGPM,FA,KG,MTS,BAB250-MR1/MYBGPM/FA/KG/MTS,Tot.Inventory (Forecast),0,11/20/2025,2400.00
SF,RM,BAB250-MR1,MYBGPM,FA,KG,MTS,BAB250-MR1/MYBGPM/FA/KG/MTS,Tot.Target Inv.,0,11/20/2025,3000.00`;

const DEFAULT_BOM = [
    { parent: 'AAG620-MR2', child: 'BAB250-MR1', ratio: 0.5, plant: 'MYBGPM' }, 
];

const CustomTooltip = ({ active, payload, label, isDarkMode }) => {
    if (active && payload && payload.length) {
        return (
            <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-100 text-slate-700'} backdrop-blur-md p-3 rounded-xl shadow-2xl border text-xs z-50`}>
                <p className={`font-bold mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                <div className="space-y-1">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color || entry.fill }} />
                                <span className="opacity-80">{entry.name}</span>
                            </div>
                            <span className="font-mono font-semibold">
                                {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const SearchableSelect = ({ label, value, options, onChange, multi = false, isDarkMode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const wrapperRef = useRef(null);

    const filteredOptions = useMemo(() => {
        return options.filter(opt =>
            opt.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleMultiSelect = (opt) => {
        let newValue;
        if (opt === 'All') newValue = ['All'];
        else {
            let current = value.includes('All') ? [] : [...value];
            if (current.includes(opt)) current = current.filter(item => item !== opt);
            else current.push(opt);
            newValue = current.length === 0 ? ['All'] : current;
        }
        onChange(newValue);
    };

    const getDisplayText = () => {
        if (multi) {
            if (value.includes('All')) return 'All';
            if (value.length === 1) return value[0];
            return `${value.length} selected`;
        }
        return value || 'All';
    };

    return (
        <div className="relative group" ref={wrapperRef}>
            <label className={`block text-[10px] font-bold mb-1 uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
            <button
                className={`w-full rounded-lg border px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-all duration-200 ease-in-out
                    ${isOpen 
                        ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-md' 
                        : isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600' 
                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-sm'}`}
                onClick={() => { if (!isOpen) setSearchTerm(""); setIsOpen(!isOpen); }}
            >
                <span className="truncate block max-w-[140px] text-left font-medium">{getDisplayText()}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} opacity-50`} />
            </button>

            {isOpen && (
                <div className={`absolute z-50 w-full mt-1 rounded-xl shadow-2xl border max-h-60 flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                    <div className={`p-2 border-b ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-50 bg-slate-50/50'}`}>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 opacity-50" />
                            <input
                                type="text"
                                className={`w-full pl-7 pr-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1 py-1 scrollbar-thin">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt}
                                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors
                                        ${value === opt || (multi && value.includes(opt)) 
                                            ? 'bg-indigo-500/10 text-indigo-600 font-semibold' 
                                            : isDarkMode ? 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                    onClick={(e) => {
                                        if (multi) { e.stopPropagation(); handleMultiSelect(opt); } 
                                        else { onChange(opt); setIsOpen(false); }
                                    }}
                                >
                                    <span className="truncate">{opt}</span>
                                    {multi && (
                                        (value.includes(opt))
                                            ? <CheckSquare className="w-3 h-3 text-indigo-500" />
                                            : <Square className="w-3 h-3 opacity-30" />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-xs opacity-50 text-center italic">No results</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Weekly Health Indicator ---
const WeeklyHealthIndicator = React.memo(({ data, isDarkMode }) => {
    if (!data || data.length === 0) return <div className="text-[9px] opacity-40 mt-1.5">No forecast data</div>;

    return (
        <div className="flex items-center gap-0.5 mt-2">
            {data.map((w, idx) => {
                let colorClass = isDarkMode ? 'bg-slate-800' : 'bg-slate-200';
                if (w.pct >= 100) colorClass = 'bg-emerald-500';
                else if (w.pct > 0) colorClass = 'bg-amber-500';
                else colorClass = 'bg-rose-500';
                
                return (
                    <div key={idx} className="group relative flex-1 h-1 first:rounded-l-sm last:rounded-r-sm bg-opacity-20 overflow-hidden">
                        <div className={`h-full w-full ${colorClass} shadow-[0_0_4px_rgba(0,0,0,0.2)]`} title={`Week ${w.week}: ${w.pct.toFixed(0)}% Target`}></div>
                    </div>
                );
            })}
        </div>
    );
});

// --- Node Card ---
const NodeCard = React.memo(({ node, onSelect, isActive, onOpenDetail, isDarkMode }) => {
    const baseClasses = isDarkMode 
        ? "bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600" 
        : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md";
    
    const activeClasses = isDarkMode
        ? "ring-1 ring-indigo-500 bg-indigo-900/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
        : "ring-2 ring-indigo-500 border-transparent shadow-lg";

    return (
        <div 
            className={`relative flex flex-col p-3 rounded-xl border-[0.5px] transition-all duration-200 cursor-pointer group
                ${isActive ? activeClasses : baseClasses}`}
            onClick={onSelect}
        >
            <div className="flex justify-between items-start mb-1.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border 
                        ${isActive ? 'bg-indigo-500 text-white border-transparent' : isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                        {node.type}
                    </span>
                    <div className="flex flex-col min-w-0">
                         <div className={`text-xs font-bold truncate max-w-[160px] ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`} title={node.id}>{node.id}</div>
                         <div className="flex items-center text-[10px] opacity-60">
                             <MapPin className="w-2.5 h-2.5 mr-1" />
                             {node.invOrg}
                         </div>
                    </div>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(node); }}
                    className={`p-1.5 rounded-lg transition-colors z-10 relative ${isDarkMode ? 'hover:bg-slate-700 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
                    title="View Details"
                >
                    <Table className="w-3.5 h-3.5" />
                </button>
            </div>
            
            <div className="flex items-baseline justify-between mt-1">
                <div className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Start Inv: <span className={node.currentInv < 0 ? "text-rose-500 font-bold" : ""}>{node.currentInv?.toLocaleString() || 0}</span>
                </div>
                {node.status === 'Critical' && <div className="animate-pulse"><AlertTriangle className="w-3.5 h-3.5 text-rose-500" /></div>}
            </div>

            <WeeklyHealthIndicator data={node.weeklyHealth} isDarkMode={isDarkMode} />
        </div>
    );
});

// --- Render Column Helper ---
const RenderColumn = React.memo(({ title, count, items, type, searchTerm, setSearchTerm, setSort, sortValue, isActiveCol, isDarkMode, children }) => (
    <div className={`flex flex-col h-full min-h-0 border-r ${isDarkMode ? 'border-slate-800 bg-slate-900/20' : 'border-slate-200/60 bg-slate-50/30'} ${isActiveCol ? (isDarkMode ? 'bg-indigo-900/10' : 'bg-indigo-50/30') : ''} min-w-[300px] flex-1`}>
        <div className={`p-4 border-b backdrop-blur-sm sticky top-0 z-10 ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200/60 bg-white/80'}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {type === 'RM' ? <Box className="w-3.5 h-3.5" /> : (type === 'FG' ? <Factory className="w-3.5 h-3.5" /> : <Warehouse className="w-3.5 h-3.5" />)}
                    {title} <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>{count}</span>
                </h3>
                <div className="flex gap-1">
                    <button onClick={() => setSort('alpha')} className={`p-1.5 rounded transition-colors ${sortValue === 'alpha' ? (isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-white shadow-sm text-indigo-600') : 'opacity-40 hover:opacity-100'}`} title="Sort Alpha"><ArrowUpDown className="w-3.5 h-3.5" /></button>
                    {/* CHANGED: 'invAsc' means Lowest First */}
                    <button onClick={() => setSort('invAsc')} className={`p-1.5 rounded transition-colors ${sortValue === 'invAsc' ? (isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-white shadow-sm text-indigo-600') : 'opacity-40 hover:opacity-100'}`} title="Sort Inv (Low-to-High)"><Activity className="w-3.5 h-3.5" /></button>
                </div>
            </div>
            <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                <input 
                    type="text" 
                    className={`w-full pl-8 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors
                        ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'}`}
                    placeholder="Filter items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {children}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin min-h-0">
            {items.length > 0 ? items.map(node => (
                <React.Fragment key={`${node.id}-${node.invOrg}`}>
                   {node.component}
                </React.Fragment>
            )) : <div className="text-xs text-center opacity-40 py-12 italic">No items found</div>}
        </div>
    </div>
));


// --- Supply Chain Network Map Component ---
const SupplyChainMap = ({ selectedItemFromParent, bomData, inventoryData, dateRange, onOpenDetails, onNodeSelect, isDarkMode }) => {
    const [mapFocus, setMapFocus] = useState(null); 
    
    // List States
    const [searchTermRM, setSearchTermRM] = useState("");
    const [searchTermFG, setSearchTermFG] = useState("");
    const [searchTermDC, setSearchTermDC] = useState(""); 
    
    // Sort States
    const [sortRM, setSortRM] = useState("alpha"); 
    const [sortFG, setSortFG] = useState("alpha");
    const [sortDC, setSortDC] = useState("alpha"); 

    // Filters
    const [rmClassFilter, setRmClassFilter] = useState('All');
    const [fgPlantFilter, setFgPlantFilter] = useState('All'); 
    const [dcFilter, setDcFilter] = useState('All'); 

    // Reset Internal Map State
    const handleReset = () => {
        setMapFocus(null);
        setSearchTermRM(""); setSearchTermFG(""); setSearchTermDC("");
        setRmClassFilter('All'); setFgPlantFilter('All'); setDcFilter('All');
        setSortRM('alpha'); setSortFG('alpha'); setSortDC('alpha');
        onNodeSelect(null); 
    };

    useEffect(() => {
        if (selectedItemFromParent) {
            let type = 'FG';
            if (PLANT_ORGS.includes(selectedItemFromParent.invOrg)) type = 'FG';
            else if (DC_ORGS.includes(selectedItemFromParent.invOrg)) type = 'DC';
            else type = 'RM'; 

            if (!mapFocus || mapFocus.id !== selectedItemFromParent.itemCode) {
                setMapFocus({ 
                    type: type,
                    id: selectedItemFromParent.itemCode, 
                    invOrg: selectedItemFromParent.invOrg 
                });
            }
        }
    }, [selectedItemFromParent, inventoryData]);

    // 1. Index Data
    const dataIndex = useMemo(() => {
        const idx = {}; // Key: "ItemCode|InvOrg"
        const rmKeys = new Set();
        const fgKeys = new Set();
        const dcKeys = new Set();

        inventoryData.forEach(row => {
            const key = `${row['Item Code']}|${row['Inv Org']}`;
            if (!idx[key]) idx[key] = [];
            idx[key].push(row);
            
            if (row.Type === 'RM') rmKeys.add(key);
            else if (row.Type === 'FG') {
                if (PLANT_ORGS.includes(row['Inv Org'])) fgKeys.add(key);
                else if (DC_ORGS.includes(row['Inv Org'])) dcKeys.add(key);
            }
        });
        return { index: idx, rmKeys: Array.from(rmKeys), fgKeys: Array.from(fgKeys), dcKeys: Array.from(dcKeys) };
    }, [inventoryData]);

    // 2. Index BOM
    const bomIndex = useMemo(() => {
        const p2c = {}; // Parent+Plant -> Children+Plant
        const c2p = {}; // Child+Plant -> Parents+Plant
        const parents = new Set();
        const children = new Set();

        bomData.forEach(b => {
            const parentKey = `${b.parent}|${b.plant}`;
            const childKey = `${b.child}|${b.plant}`;

            if (!p2c[parentKey]) p2c[parentKey] = new Set();
            p2c[parentKey].add(childKey);
            parents.add(parentKey);

            if (!c2p[childKey]) c2p[childKey] = new Set();
            c2p[childKey].add(parentKey);
            children.add(childKey);
        });
        return { p2c, c2p, parents, children };
    }, [bomData]);

    // 3. Get Stats
    const getNodeStats = useCallback((key, type) => {
        const records = dataIndex.index[key];
        if (!records) return null;

        const firstRec = records[0];
        const itemCode = firstRec['Item Code'];
        const invOrg = firstRec['Inv Org'];
        const itemClass = firstRec['Item Class']; 

        const validRecords = records.filter(d => 
            (!dateRange.start || d._dateObj >= new Date(dateRange.start)) &&
            (!dateRange.end || d._dateObj <= new Date(dateRange.end))
        );

        const weeklyMap = {};
        validRecords.forEach(r => {
            if (r.Metric === 'Tot.Inventory (Forecast)' || r.Metric === 'Tot.Target Inv.') {
                const weekNum = Math.floor(r._dateObj.getTime() / (7 * 24 * 60 * 60 * 1000));
                if (!weeklyMap[weekNum]) weeklyMap[weekNum] = { inv: 0, target: 0, count: 0 };
                
                if (r.Metric === 'Tot.Inventory (Forecast)') {
                    weeklyMap[weekNum].inv += r.Value;
                    weeklyMap[weekNum].count++;
                }
                if (r.Metric === 'Tot.Target Inv.') {
                    weeklyMap[weekNum].target += r.Value;
                }
            }
        });

        const weeklyHealth = Object.keys(weeklyMap).sort().map(w => {
            const d = weeklyMap[w];
            const avgInv = d.count ? d.inv / d.count : 0;
            const avgTarget = d.count ? d.target / d.count : 1;
            return { week: w, pct: avgTarget > 0 ? (avgInv / avgTarget) * 100 : 0 };
        });

        const invRows = validRecords.filter(r => r.Metric === 'Tot.Inventory (Forecast)');
        invRows.sort((a, b) => {
            if (a._dateObj && b._dateObj) return a._dateObj - b._dateObj;
            return (a.Start ?? 0) - (b.Start ?? 0);
        });

        // Show the starting forecast inventory value
        const currentInv = invRows.length > 0 ? invRows[0].Value : 0;
        const status = currentInv < 0 ? 'Critical' : (currentInv < 1000 ? 'Low' : 'Good');

        return {
            id: itemCode,
            itemCode: itemCode,
            invOrg: invOrg,
            itemClass: itemClass,
            type,
            status,
            currentInv,
            weeklyHealth
        };
    }, [dataIndex, dateRange]);

    // 4. Generate Lists
    const { rmList, fgList, dcList } = useMemo(() => {
        let targetRMKeys = dataIndex.rmKeys;
        let targetFGKeys = dataIndex.fgKeys;
        let targetDCKeys = dataIndex.dcKeys;

        targetRMKeys = targetRMKeys.filter(k => bomIndex.children.has(k));
        targetFGKeys = targetFGKeys.filter(k => bomIndex.parents.has(k));

        if (mapFocus) {
            const focusId = mapFocus.id;

            if (mapFocus.type === 'FG') {
                const parentKey = `${focusId}|${mapFocus.invOrg}`;
                const ingredients = bomIndex.p2c[parentKey];
                if (ingredients) targetRMKeys = targetRMKeys.filter(k => ingredients.has(k));
                else targetRMKeys = [];

                targetDCKeys = targetDCKeys.filter(k => k.split('|')[0] === focusId);

            } else if (mapFocus.type === 'RM') {
                const childKey = `${focusId}|${mapFocus.invOrg}`;
                const consumers = bomIndex.c2p[childKey];
                if (consumers) targetFGKeys = targetFGKeys.filter(k => consumers.has(k));
                else targetFGKeys = [];

                const visibleFgCodes = new Set(targetFGKeys.map(k => k.split('|')[0]));
                targetDCKeys = targetDCKeys.filter(k => visibleFgCodes.has(k.split('|')[0]));

            } else if (mapFocus.type === 'DC') {
                targetFGKeys = targetFGKeys.filter(k => k.split('|')[0] === focusId);

                const ingredientKeys = new Set();
                targetFGKeys.forEach(parentKey => {
                    const ingredients = bomIndex.p2c[parentKey];
                    if (ingredients) ingredients.forEach(i => ingredientKeys.add(i));
                });

                if (ingredientKeys.size > 0) targetRMKeys = targetRMKeys.filter(k => ingredientKeys.has(k));
                else targetRMKeys = [];
            }
        }

        if (searchTermRM) targetRMKeys = targetRMKeys.filter(k => k.toLowerCase().includes(searchTermRM.toLowerCase()));
        if (searchTermFG) targetFGKeys = targetFGKeys.filter(k => k.toLowerCase().includes(searchTermFG.toLowerCase()));
        if (searchTermDC) targetDCKeys = targetDCKeys.filter(k => k.toLowerCase().includes(searchTermDC.toLowerCase()));

        let rmNodes = targetRMKeys.map(k => getNodeStats(k, 'RM')).filter(Boolean);
        let fgNodes = targetFGKeys.map(k => getNodeStats(k, 'FG')).filter(Boolean);
        let dcNodes = targetDCKeys.map(k => getNodeStats(k, 'DC')).filter(Boolean);

        if (rmClassFilter !== 'All') {
            rmNodes = rmNodes.filter(n => n.itemClass && n.itemClass.includes(rmClassFilter));
        }
        if (fgPlantFilter !== 'All') {
            fgNodes = fgNodes.filter(n => n.invOrg === fgPlantFilter);
        }
        if (dcFilter !== 'All') {
            dcNodes = dcNodes.filter(n => n.invOrg === dcFilter);
        }

        const sorter = (a, b, method) => {
            if (method === 'alpha') return a.id.localeCompare(b.id);
            // invAsc = Lowest Inventory First (Ascending)
            if (method === 'invAsc') return a.currentInv - b.currentInv;
            return 0;
        };
        
        rmNodes.sort((a, b) => sorter(a, b, sortRM));
        fgNodes.sort((a, b) => sorter(a, b, sortFG));
        dcNodes.sort((a, b) => sorter(a, b, sortDC));

        const wrapNode = (n) => ({
            id: n.id, 
            invOrg: n.invOrg,
            component: (
                <NodeCard 
                    key={`${n.id}-${n.invOrg}`} 
                    node={n} 
                    isActive={mapFocus && mapFocus.id === n.id && mapFocus.invOrg === n.invOrg}
                    onSelect={() => {
                        setMapFocus(n);
                        onNodeSelect(n); 
                    }}
                    onOpenDetail={onOpenDetails}
                    isDarkMode={isDarkMode}
                />
            )
        });

        return { 
            rmList: rmNodes.map(wrapNode), 
            fgList: fgNodes.map(wrapNode),
            dcList: dcNodes.map(wrapNode)
        };

    }, [dataIndex, bomIndex, mapFocus, searchTermRM, searchTermFG, searchTermDC, sortRM, sortFG, sortDC, dateRange, getNodeStats, onOpenDetails, rmClassFilter, fgPlantFilter, dcFilter, onNodeSelect, isDarkMode]);

    return (
        <div className={`flex h-full min-h-0 overflow-hidden rounded-2xl border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-200 shadow-slate-200/50'} relative transition-colors duration-300`}>
            
            {/* Reset Map Button */}
            <div className="absolute top-3 right-3 z-30">
                <button 
                    onClick={handleReset}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg shadow-sm transition-all ${isDarkMode ? 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white/95 border-slate-300 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}
                >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
            </div>

            {/* RM Column */}
            <RenderColumn 
                title="Raw Materials" 
                count={rmList.length} 
                items={rmList} 
                type="RM"
                searchTerm={searchTermRM}
                setSearchTerm={setSearchTermRM}
                sortValue={sortRM}
                setSort={setSortRM}
                isActiveCol={mapFocus && mapFocus.type === 'RM'}
                isDarkMode={isDarkMode}
            >
                <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
                    {['All', 'FA', 'AD', 'LI'].map(cls => (
                        <button 
                            key={cls}
                            onClick={() => setRmClassFilter(cls)}
                            className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all whitespace-nowrap uppercase tracking-wide
                                ${rmClassFilter === cls 
                                    ? 'bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-500/30' 
                                    : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                        >
                            {cls}
                        </button>
                    ))}
                </div>
            </RenderColumn>

            {/* FG Column */}
            <RenderColumn 
                title="Finished Goods (Plant)" 
                count={fgList.length} 
                items={fgList} 
                type="FG"
                searchTerm={searchTermFG}
                setSearchTerm={setSearchTermFG}
                sortValue={sortFG}
                setSort={setSortFG}
                isActiveCol={mapFocus && mapFocus.type === 'FG'}
                isDarkMode={isDarkMode}
            >
                <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
                    {['All', ...PLANT_ORGS].map(org => (
                        <button 
                            key={org}
                            onClick={() => setFgPlantFilter(org)}
                            className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all whitespace-nowrap uppercase tracking-wide
                                ${fgPlantFilter === org 
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/30' 
                                    : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                        >
                            {org}
                        </button>
                    ))}
                </div>
            </RenderColumn>

            {/* DC Column */}
            <RenderColumn 
                title="Distribution Centers" 
                count={dcList.length} 
                items={dcList} 
                type="DC"
                searchTerm={searchTermDC}
                setSearchTerm={setSearchTermDC}
                sortValue={sortDC}
                setSort={setSortDC}
                isActiveCol={mapFocus && mapFocus.type === 'DC'}
                isDarkMode={isDarkMode}
            >
                <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
                    {['All', ...DC_ORGS].map(org => (
                        <button 
                            key={org}
                            onClick={() => setDcFilter(org)}
                            className={`text-[9px] font-bold px-2.5 py-1 rounded-full border transition-all whitespace-nowrap uppercase tracking-wide
                                ${dcFilter === org 
                                    ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/30' 
                                    : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                        >
                            {org}
                        </button>
                    ))}
                </div>
            </RenderColumn>
        </div>
    );
};

export default function SupplyChainDashboard() {
    const [rawData, setRawData] = useState([]);
    const [bomData, setBomData] = useState(DEFAULT_BOM);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    
    // --- DEFAULT METRIC CHANGE ---
    const [filters, setFilters] = useState({
        itemCode: 'All',
        invOrg: 'All',
        itemClass: 'All',
        uom: 'All',
        strategy: 'All',
        metric: ['Tot.Target Inv.', 'Tot.Inventory (Forecast)'] // New Default
    });
    
    const [isLeadTimeMode, setIsLeadTimeMode] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [hoveredDate, setHoveredDate] = useState(null);
    const [riskFilters, setRiskFilters] = useState({
        critical: true,
        watchOut: true,
        minDays: 1
    });
    const [ganttSort, setGanttSort] = useState('itemCode');
    const [isLoading, setIsLoading] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);

    const handleDataLoad = (data) => {
        setRawData(data);
        const validTimes = [];
        for (let i = 0; i < data.length; i++) {
            if(data[i]._dateObj && !isNaN(data[i]._dateObj.getTime())) {
                validTimes.push(data[i]._dateObj.getTime());
            }
        }
        if (validTimes.length > 0) {
            let minTime = validTimes[0];
            let maxTime = validTimes[0];
            for (let i = 1; i < validTimes.length; i++) {
                if (validTimes[i] < minTime) minTime = validTimes[i];
                if (validTimes[i] > maxTime) maxTime = validTimes[i];
            }
            setDateRange({
                start: toInputDate(new Date(minTime)),
                end: toInputDate(new Date(maxTime))
            });
        }
    };

    // --- Fetch from Google Sheets ---
    useEffect(() => {
        const fetchData = async () => {
            if (!GOOGLE_SHEET_CONFIG.INVENTORY_URL || !GOOGLE_SHEET_CONFIG.BOM_URL) {
                const parsed = parseCSV(SAMPLE_CSV);
                handleDataLoad(parsed);
                return;
            }

            setIsLoading(true);
            try {
                const [invRes, bomRes] = await Promise.all([
                    fetch(GOOGLE_SHEET_CONFIG.INVENTORY_URL),
                    fetch(GOOGLE_SHEET_CONFIG.BOM_URL)
                ]);

                const invText = await invRes.text();
                const bomText = await bomRes.text();

                const invData = parseCSV(invText);
                const bomParsed = parseCSV(bomText);

                const processedBom = bomParsed.map(row => ({
                    plant: row['Plant'] || row['Plant '],
                    parent: row['Parent'] || row['Parent Item'] || row['Parent Item '],
                    child: row['Child'] || row['Child Item'] || row['Child Item '],
                    ratio: parseFloat(row['Ratio'] || row['Quantity Per'] || row['Quantity Per '] || row['qty'] || 0)
                })).filter(row => row.parent && row.child);

                handleDataLoad(invData);
                setBomData(processedBom);

            } catch (error) {
                console.error("Failed to load Google Sheets", error);
                const parsed = parseCSV(SAMPLE_CSV);
                handleDataLoad(parsed);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleInventoryUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const parsed = parseCSV(text);
            handleDataLoad(parsed);
        };
        reader.readAsText(file);
    };

    const handleBomUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const rawParsed = parseCSV(text);
            const processedBom = rawParsed.map(row => ({
                plant: row['Plant'] || row['Plant '],
                parent: row['Parent'] || row['Parent Item'] || row['Parent Item '],
                child: row['Child'] || row['Child Item'] || row['Child Item '],
                ratio: parseFloat(row['Ratio'] || row['Quantity Per'] || row['Quantity Per '] || row['qty'] || 0)
            })).filter(row => row.parent && row.child);

            setBomData(processedBom);
            alert(`Successfully imported ${processedBom.length} BOM records.`);
        };
        reader.readAsText(file);
    };

    const options = useMemo(() => {
        const getFilteredDataForField = (excludeKey) => {
            return rawData.filter(item => {
                const itemDate = item._dateObj;
                const startDate = dateRange.start ? new Date(dateRange.start) : null;
                const endDate = dateRange.end ? new Date(dateRange.end) : null;
                const inDateRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                if (!inDateRange) return false;
                return (
                    inDateRange &&
                    (excludeKey === 'itemCode' || filters.itemCode === 'All' || item['Item Code'] === filters.itemCode) &&
                    (excludeKey === 'invOrg' || filters.invOrg === 'All' || item['Inv Org'] === filters.invOrg) &&
                    (excludeKey === 'itemClass' || filters.itemClass === 'All' || item['Item Class'] === filters.itemClass) &&
                    (excludeKey === 'uom' || filters.uom === 'All' || item['UOM'] === filters.uom) &&
                    (excludeKey === 'strategy' || filters.strategy === 'All' || item['Strategy'] === filters.strategy)
                );
            });
        };
        const getUnique = (data, key) => ['All', ...new Set(data.map(d => d[key]).filter(Boolean))].sort();
        return {
            itemCodes: getUnique(getFilteredDataForField('itemCode'), 'Item Code'),
            invOrgs: getUnique(getFilteredDataForField('invOrg'), 'Inv Org'),
            itemClasses: getUnique(getFilteredDataForField('itemClass'), 'Item Class'),
            uoms: getUnique(getFilteredDataForField('uom'), 'UOM'),
            strategies: getUnique(getFilteredDataForField('strategy'), 'Strategy'),
            metrics: getUnique(getFilteredDataForField('metric'), 'Metric'),
        };
    }, [rawData, filters, dateRange]);

    const filteredData = useMemo(() => {
        return rawData.filter(item => {
            const itemDate = item._dateObj;
            const startDate = dateRange.start ? new Date(dateRange.start) : null;
            const endDate = dateRange.end ? new Date(dateRange.end) : null;
            const inDateRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
            
            return (
                inDateRange &&
                (filters.itemCode === 'All' || item['Item Code'] === filters.itemCode) &&
                (filters.invOrg === 'All' || item['Inv Org'] === filters.invOrg) &&
                (filters.itemClass === 'All' || item['Item Class'] === filters.itemClass) &&
                (filters.uom === 'All' || item['UOM'] === filters.uom) &&
                (filters.strategy === 'All' || item['Strategy'] === filters.strategy)
            );
        });
    }, [rawData, filters, dateRange]);

    const chartData = useMemo(() => {
        let sourceData = filteredData;
        if (selectedItem) {
            sourceData = rawData.filter(d => 
                d['Item Code'] === selectedItem.itemCode && 
                d['Inv Org'] === selectedItem.invOrg &&
                (!dateRange.start || d._dateObj >= new Date(dateRange.start)) &&
                (!dateRange.end || d._dateObj <= new Date(dateRange.end))
            );
        }

        const grouped = {};
        const chartFiltered = sourceData.filter(item => 
             filters.metric.includes('All') || filters.metric.includes(item.Metric)
        );

        chartFiltered.forEach(item => {
            if (!grouped[item.Date]) {
                grouped[item.Date] = { date: item.Date, _dateObj: item._dateObj };
            }
            if (!grouped[item.Date][item.Metric]) {
                grouped[item.Date][item.Metric] = 0;
            }
            grouped[item.Date][item.Metric] += (item.Value || 0);
        });
        return Object.values(grouped).sort((a, b) => a._dateObj - b._dateObj);
    }, [filteredData, filters.metric, selectedItem, rawData, dateRange]);

    const ganttData = useMemo(() => {
        const grouped = {};
        const today = new Date();

        filteredData.forEach(item => {
            const key = `${item['Item Code']}|${item['Inv Org']}`;
            if (!grouped[key]) grouped[key] = { itemCode: item['Item Code'], invOrg: item['Inv Org'], days: {} };
            if (!grouped[key].days[item.Date]) grouped[key].days[item.Date] = { _dateObj: item._dateObj, metrics: {} };
            const normMetric = item.Metric.trim();
            grouped[key].days[item.Date].metrics[normMetric] = (grouped[key].days[item.Date].metrics[normMetric] || 0) + (item.Value || 0);
        });

        let rows = [];

        Object.values(grouped).forEach(group => {
            const sortedDates = Object.values(group.days).sort((a, b) => a._dateObj - b._dateObj);
            const blocks = [];
            let currentBlock = null;
            
            let totalShortageDays = 0;
            let hasInsideLeadTimeRisk = false;
            let firstOutsideLeadTimeRiskDate = 9999999999999;
            const leadTimeWeeks = getLeadTimeWeeks(group.invOrg);
            const leadTimeDate = addWeeks(today, leadTimeWeeks);

            sortedDates.forEach(day => {
                const m = day.metrics;
                const totReq = m['Tot.Req.'] || 0;
                const indepReq = m['Indep. Req. (Forecast)'] || 0;
                const inventory = m['Tot.Inventory (Forecast)'] || 0;
                const targetInv = m['Tot.Target Inv.'] || 0;

                let status = null;
                if ((totReq + indepReq) > inventory) status = 'Critical';
                else if (inventory < targetInv && (totReq + indepReq) <= 0.001) status = 'Watch Out';

                if (status) {
                    if (day._dateObj <= leadTimeDate) hasInsideLeadTimeRisk = true;
                    else if (day._dateObj.getTime() < firstOutsideLeadTimeRiskDate) firstOutsideLeadTimeRiskDate = day._dateObj.getTime();

                    if (currentBlock && currentBlock.status === status && (day._dateObj.getTime() - currentBlock.end.getTime() <= 86400000 + 10000)) {
                        currentBlock.end = day._dateObj;
                        currentBlock.days += 1;
                    } else {
                        if (currentBlock) blocks.push(currentBlock);
                        currentBlock = { start: day._dateObj, end: day._dateObj, status: status, days: 1 };
                    }
                } else {
                    if (currentBlock) { blocks.push(currentBlock); currentBlock = null; }
                }
            });
            if (currentBlock) blocks.push(currentBlock);

            const filteredBlocks = blocks.filter(b => {
                if (b.days < riskFilters.minDays) return false;
                if (b.status === 'Critical' && !riskFilters.critical) return false;
                if (b.status === 'Watch Out' && !riskFilters.watchOut) return false;
                return true;
            });

            totalShortageDays = filteredBlocks.reduce((acc, b) => acc + b.days, 0);

            if (filteredBlocks.length > 0) {
                rows.push({
                    itemCode: group.itemCode, invOrg: group.invOrg, blocks: filteredBlocks,
                    totalShortageDays, hasInsideLeadTimeRisk, firstOutsideLeadTimeRiskDate
                });
            }
        });

        rows.sort((a, b) => {
            if (ganttSort === 'itemCode') return a.itemCode.localeCompare(b.itemCode);
            if (ganttSort === 'leadTime') {
                if (a.hasInsideLeadTimeRisk !== b.hasInsideLeadTimeRisk) return a.hasInsideLeadTimeRisk ? -1 : 1; 
                return b.totalShortageDays - a.totalShortageDays;
            }
            if (ganttSort === 'duration') return b.totalShortageDays - a.totalShortageDays;
            if (ganttSort === 'planning') return a.firstOutsideLeadTimeRiskDate - b.firstOutsideLeadTimeRiskDate;
            return 0;
        });

        return rows;
    }, [filteredData, riskFilters, ganttSort]);

    const selectedItemData = useMemo(() => {
        if (!selectedItem) return null;
        const itemsData = rawData.filter(d => d['Item Code'] === selectedItem.itemCode && d['Inv Org'] === selectedItem.invOrg);
        const startDate = dateRange.start ? new Date(dateRange.start) : null;
        const endDate = dateRange.end ? new Date(dateRange.end) : null;
        const uniqueDates = new Set();
        const uniqueMetrics = new Set();
        const valueMap = {};

        itemsData.forEach(d => {
             const itemDate = d._dateObj;
             if (startDate && itemDate < startDate) return;
             if (endDate && itemDate > endDate) return;
             uniqueDates.add(d.Date);
             const metric = d.Metric.trim();
             uniqueMetrics.add(metric);
             if (!valueMap[metric]) valueMap[metric] = {};
             valueMap[metric][d.Date] = d.Value;
        });

        const sortedDates = Array.from(uniqueDates).sort((a,b) => new Date(a) - new Date(b));
        const sortedMetrics = Array.from(uniqueMetrics).sort();
        return { dates: sortedDates, metrics: sortedMetrics, values: valueMap };
    }, [selectedItem, rawData, dateRange]);

    const getInventoryCellClass = (val, targetVal) => {
        if (val === undefined || val === null || Number.isNaN(val)) return isDarkMode ? "text-slate-500" : "text-slate-400";
        if (!targetVal) return val < 0
            ? "text-red-500 font-bold bg-red-500/10"
            : (isDarkMode ? "text-slate-300 font-medium" : "text-slate-700 font-medium");

        const ratio = (val / targetVal) * 100;
        if (ratio > 120) return isDarkMode ? "text-blue-300 font-semibold bg-blue-500/10" : "text-blue-600 font-semibold bg-blue-50";
        if (ratio >= 80) return isDarkMode ? "text-emerald-300 font-semibold bg-emerald-500/10" : "text-emerald-600 font-semibold bg-emerald-50";
        if (ratio >= 30) return isDarkMode ? "text-amber-200 font-semibold bg-amber-500/10" : "text-amber-600 font-semibold bg-amber-50";
        if (ratio > 0) return isDarkMode ? "text-orange-200 font-semibold bg-orange-500/10" : "text-orange-600 font-semibold bg-orange-50";
        return "text-red-500 font-bold bg-red-500/10";
    };

    const activeMetrics = useMemo(() => {
        if (filters.metric.includes('All')) return Array.from(new Set(filteredData.map(d => d.Metric)));
        return filters.metric;
    }, [filteredData, filters.metric]);

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    const resetFilters = () => {
        setIsLeadTimeMode(false);
        setFilters({ itemCode: 'All', invOrg: 'All', itemClass: 'All', uom: 'All', strategy: 'All', metric: ['Tot.Target Inv.', 'Tot.Inventory (Forecast)'] });
        setRiskFilters({ critical: true, watchOut: true, minDays: 1 });
        setSelectedItem(null);
        setIsDetailOpen(false);
        setGanttSort('itemCode');
        setHoveredDate(null);
        const validTimes = [];
        for (let i = 0; i < rawData.length; i++) {
            const t = rawData[i]._dateObj ? rawData[i]._dateObj.getTime() : NaN;
            if (!isNaN(t)) validTimes.push(t);
        }
        if (validTimes.length > 0) {
            let minTime = validTimes[0];
            let maxTime = validTimes[0];
            for (let i = 1; i < validTimes.length; i++) {
                if (validTimes[i] < minTime) minTime = validTimes[i];
                if (validTimes[i] > maxTime) maxTime = validTimes[i];
            }
            setDateRange({ start: toInputDate(new Date(minTime)), end: toInputDate(new Date(maxTime)) });
        }
    };

    const getGanttStyles = (start, end) => {
        if (!dateRange.start || !dateRange.end) return { left: '0%', width: '0%' };
        const min = new Date(dateRange.start).getTime();
        const max = new Date(dateRange.end).getTime();
        const total = max - min;
        if (total <= 0) return { left: '0%', width: '0%' };
        const s = start.getTime();
        const e = end.getTime();
        const left = Math.max(0, ((s - min) / total) * 100);
        const right = Math.min(100, ((e - min) / total) * 100);
        const width = Math.max(0.5, right - left);
        return { left: `${left}%`, width: `${width}%` };
    };

    const onNodeSelectCallback = useCallback((node) => {
        if (node) setSelectedItem({ itemCode: node.id, invOrg: node.invOrg, type: node.type });
        else setSelectedItem(null);
    }, []);

    const onOpenDetailsCallback = useCallback((node) => {
        setSelectedItem({ itemCode: node.id, invOrg: node.invOrg, type: node.type });
        setIsDetailOpen(true);
    }, []);

    const Y_AXIS_WIDTH = 200; 

    return (
        <div className={`min-h-screen pb-20 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
             {/* HEADER */}
             <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300 ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200/60'}`}>
                <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Supply Chain <span className="text-indigo-500">Center</span></h1>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Inventory Intelligence</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        {/* Dark Mode Toggle */}
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:text-yellow-300' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600'}`}>
                            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <div className={`h-6 w-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                        
                        <button onClick={() => window.location.reload()} className={`group flex items-center px-3 py-2 border rounded-xl transition-all text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'}`} title="Reload Data">
                             <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <label className={`group flex items-center px-3 py-2 border rounded-xl cursor-pointer transition-all text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-500" />Import BOM<input type="file" accept=".csv" onChange={handleBomUpload} className="hidden" />
                        </label>
                        <label className={`group flex items-center px-3 py-2 border rounded-xl cursor-pointer transition-all text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                            <Upload className="w-3.5 h-3.5 mr-2 text-indigo-500" />Import CSV<input type="file" accept=".csv" onChange={handleInventoryUpload} className="hidden" />
                        </label>
                    </div>
                </div>
            </header>

            <div className="flex min-h-[calc(100vh-64px)] max-w-[1800px] mx-auto">
                {/* --- LEFT SIDEBAR PLACEHOLDER (10%) --- */}
                <div className={`hidden xl:block w-[5%] 2xl:w-[10%] border-r ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50/50'}`}>
                    <div className="h-full w-full flex items-center justify-center opacity-10">
                        <PanelLeft className="w-6 h-6" />
                    </div>
                </div>

                {/* --- CENTER MAIN CONTENT (70%) --- */}
                <main className="flex-1 flex flex-col p-6 gap-6 min-w-0 overflow-hidden">
                    {/* SUPPLY CHAIN MAP (Main Stage) */}
                    <div className={`flex-1 min-h-[550px] rounded-2xl shadow-sm border p-0 overflow-hidden flex flex-col transition-all duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-black/20' : 'bg-white border-slate-200/60 shadow-slate-200/50'}`}>
                        <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50/50'}`}>
                            <div className="flex items-center space-x-3">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500"><Network className="w-5 h-5" /></div>
                                <div><h2 className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Supply Chain Network</h2><p className="text-xs text-slate-500">Live Inventory Map</p></div>
                            </div>
                        </div>
                        <div className="flex-1 relative">
                             <SupplyChainMap 
                                selectedItemFromParent={selectedItem} 
                                bomData={bomData} 
                                inventoryData={rawData} 
                                dateRange={dateRange} 
                                onOpenDetails={onOpenDetailsCallback}
                                onNodeSelect={onNodeSelectCallback}
                                isDarkMode={isDarkMode}
                            />
                        </div>
                    </div>

                    {/* RISK MONITOR (Bottom) */}
                    <div className={`h-[400px] rounded-2xl shadow-sm border flex flex-col overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-black/20' : 'bg-white border-slate-200/60 shadow-slate-200/50'}`}>
                        <div className={`p-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50/50'}`}>
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-amber-500/10 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
                                <div><h2 className={`text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Risk Monitor</h2><p className="text-xs text-slate-500">Shortage Timeline</p></div>
                            </div>
                            {/* Minified Risk Controls */}
                            <div className={`flex items-center gap-4 p-1.5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                 <div className={`flex items-center space-x-2 border-r pr-4 pl-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                                    <select className={`text-xs border-none focus:ring-0 font-medium bg-transparent cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} value={ganttSort} onChange={(e) => setGanttSort(e.target.value)}>
                                        <option value="itemCode">Name</option>
                                        <option value="leadTime">Lead Time</option>
                                        <option value="duration">Duration</option>
                                    </select>
                                </div>
                                <div className={`flex items-center space-x-3 text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={riskFilters.critical} onChange={e => setRiskFilters(p => ({...p, critical: e.target.checked}))} className="rounded text-red-500 focus:ring-red-500 border-slate-300" />Critical</label>
                                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={riskFilters.watchOut} onChange={e => setRiskFilters(p => ({...p, watchOut: e.target.checked}))} className="rounded text-amber-400 focus:ring-amber-400 border-slate-300" />Watch Out</label>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto relative scrollbar-thin">
                            {ganttData.length > 0 ? (
                                ganttData.map((row, idx) => (
                                    <div key={idx} className={`flex items-center border-b h-12 group transition-all duration-200 
                                        ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-50 hover:bg-slate-50'}
                                        ${selectedItem && selectedItem.itemCode === row.itemCode && selectedItem.invOrg === row.invOrg ? (isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50/60') : ''}`}>
                                        <div className={`flex-shrink-0 px-6 py-2 border-r truncate cursor-pointer h-full flex flex-col justify-center ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`} style={{ width: Y_AXIS_WIDTH }} onClick={() => setSelectedItem({ itemCode: row.itemCode, invOrg: row.invOrg })}>
                                            <div className={`font-bold text-sm truncate transition-colors ${isDarkMode ? 'text-slate-300 group-hover:text-indigo-400' : 'text-slate-700 group-hover:text-indigo-600'}`}>{row.itemCode}</div>
                                            <div className="text-xs text-slate-500 font-mono mt-0.5">{row.invOrg}</div>
                                        </div>
                                        <div className="flex-1 relative h-full cursor-pointer" style={{ marginLeft: '20px', marginRight: '30px' }} onClick={() => setSelectedItem({ itemCode: row.itemCode, invOrg: row.invOrg })}>
                                            <div className="absolute inset-0 flex opacity-10 pointer-events-none">
                                                <div className={`w-1/4 border-r h-full ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}></div><div className={`w-1/4 border-r h-full ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}></div><div className={`w-1/4 border-r h-full ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}></div>
                                            </div>
                                            {row.blocks.map((block, bIdx) => {
                                                const style = getGanttStyles(block.start, block.end);
                                                const isCritical = block.status === 'Critical';
                                                const colorClass = isCritical ? 'bg-red-500' : 'bg-amber-500';
                                                return (
                                                    <div key={bIdx} className={`absolute h-4 top-4 rounded-sm shadow-sm cursor-pointer hover:scale-y-110 transition-transform ${colorClass}`} style={{...style, minWidth: '8px'}} title={`${block.status}: ${block.days} Days`}></div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : <EmptyState msg="No risks match current filters" isDarkMode={isDarkMode} />}
                        </div>
                    </div>
                </main>

                {/* --- RIGHT SIDEBAR (20%) --- */}
                <aside className={`w-[300px] 2xl:w-[20%] border-l h-screen sticky top-0 overflow-y-auto z-30 shadow-xl flex flex-col transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    {/* 1. Trend Graph (Top Priority) */}
                    <div className={`p-5 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-emerald-500" />
                            <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Trend Analysis</h3>
                        </div>
                        <div className={`h-48 w-full rounded-xl border shadow-sm p-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                             {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>{colors.map((color, index) => (<linearGradient key={index} id={`color${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient>))}</defs>
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide />
                                        <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
                                        {activeMetrics.map((metric, index) => (
                                            <Area key={metric} type="monotone" dataKey={metric} stroke={colors[index % colors.length]} fill={`url(#color${index % colors.length})`} strokeWidth={2} />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">No data selected</div>}
                        </div>
                        <div className="mt-3 text-xs text-center font-mono text-slate-500 truncate">
                            {selectedItem ? `${selectedItem.itemCode} [${selectedItem.invOrg}]` : "AGGREGATE VIEW"}
                        </div>
                    </div>

                    {/* 2. Global Filters (Stacked) */}
                    <div className="p-5 flex-1 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Filter className="w-3 h-3" /> Filters</h3>
                            <button onClick={resetFilters} className="text-[10px] text-indigo-500 hover:text-indigo-400 font-medium uppercase tracking-wider">Reset All</button>
                        </div>
                        
                        <div className="space-y-5">
                            {/* Stacked Vertical Inputs */}
                            <div>
                                <label className={`block text-[9px] font-bold uppercase mb-1.5 tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Analysis Mode</label>
                                <button onClick={() => setIsLeadTimeMode(!isLeadTimeMode)} className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-all ${isLeadTimeMode ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-500' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                                    <span className="text-xs font-medium flex items-center"><Clock className="w-3.5 h-3.5 mr-2" />Lead Time Only</span>
                                    {isLeadTimeMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4 opacity-50" />}
                                </button>
                            </div>

                            <div>
                                <label className={`block text-[9px] font-bold uppercase mb-1.5 tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Date Range</label>
                                <div className="flex flex-col gap-2.5">
                                    <input type="date" disabled={isLeadTimeMode} className={`w-full px-3 py-2 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`} value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                                    <input type="date" disabled={isLeadTimeMode} className={`w-full px-3 py-2 border rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`} value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                                </div>
                            </div>

                            <SearchableSelect label="Item Code" value={filters.itemCode} options={options.itemCodes} onChange={(val) => setFilters(prev => ({ ...prev, itemCode: val }))} isDarkMode={isDarkMode} />
                            <SearchableSelect label="Inv Org" value={filters.invOrg} options={options.invOrgs} onChange={(val) => setFilters(prev => ({ ...prev, invOrg: val }))} isDarkMode={isDarkMode} />
                            <SearchableSelect label="Item Class" value={filters.itemClass} options={options.itemClasses} onChange={(val) => setFilters(prev => ({ ...prev, itemClass: val }))} isDarkMode={isDarkMode} />
                            <SearchableSelect label="Strategy" value={filters.strategy} options={options.strategies} onChange={(val) => setFilters(prev => ({ ...prev, strategy: val }))} isDarkMode={isDarkMode} />
                            
                            <div className={`pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                <SearchableSelect label="Visible Metrics" value={filters.metric} options={options.metrics} onChange={(val) => setFilters(prev => ({ ...prev, metric: val }))} multi={true} isDarkMode={isDarkMode} />
                            </div>
                        </div>
                    </div>
                </aside>

                {selectedItem && selectedItemData && isDetailOpen && (
                    <div className={`fixed inset-x-0 bottom-0 z-50 backdrop-blur-xl border-t shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] transform transition-all duration-300 ease-in-out h-96 flex flex-col animate-in slide-in-from-bottom-10 ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
                        <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white/50 border-slate-100'}`}>
                            <div className="flex items-center space-x-4">
                                <div className="bg-indigo-500/10 p-2 rounded-lg"><Table className="w-5 h-5 text-indigo-500" /></div>
                                <div><h3 className={`font-bold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedItem.itemCode}</h3><p className="text-xs text-slate-500 font-medium font-mono uppercase tracking-wider">{selectedItem.invOrg} — Detail View</p></div>
                            </div>
                            <button onClick={() => setIsDetailOpen(false)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left border-collapse relative">
                                <thead className={`text-xs uppercase sticky top-0 z-10 font-semibold tracking-wider backdrop-blur-sm ${isDarkMode ? 'bg-slate-900/90 text-slate-400' : 'bg-slate-50/90 text-slate-500'}`}>
                                    <tr>
                                        <th className={`px-6 py-3 border-b left-0 sticky z-20 border-r w-64 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>Metric</th>
                                        {selectedItemData.dates.map(dateStr => (
                                            <th key={dateStr} className={`px-3 py-3 border-b text-center min-w-[80px] transition-colors cursor-default ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-indigo-50/50'}`}>
                                                <div className="flex flex-col"><span className="text-[10px] opacity-50">{new Date(dateStr).toLocaleString('default', { weekday: 'short' })}</span><span>{new Date(dateStr).getMonth() + 1}/{new Date(dateStr).getDate()}</span></div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/10">
                                    {selectedItemData.metrics.map(metric => (
                                        <tr key={metric} className={`transition-colors group ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}`}>
                                            <td className={`px-6 py-3 font-medium sticky left-0 border-r z-10 text-xs truncate max-w-[250px] ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300 group-hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-600 group-hover:bg-slate-50'}`} title={metric}>{metric}</td>
                                            {selectedItemData.dates.map(dateStr => {
                                                const val = selectedItemData.values[metric]?.[dateStr];
                                                let cellClass = isDarkMode ? "text-slate-500" : "text-slate-400";

                                                if (metric === 'Tot.Inventory (Forecast)') {
                                                    const targetVal = selectedItemData.values['Tot.Target Inv.']?.[dateStr];
                                                    cellClass = getInventoryCellClass(val, targetVal);
                                                } else if (val > 0) {
                                                    cellClass = isDarkMode ? "text-slate-300 font-medium" : "text-slate-700 font-medium";
                                                }

                                                return <td key={dateStr} className={`px-3 py-2 text-right border-r transition-colors font-mono text-xs ${cellClass} ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>{val !== undefined ? val.toLocaleString(undefined, {maximumFractionDigits: 0}) : '-'}</td>;
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            <style jsx global>{`@keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: .85; } } .animate-pulse-slow { animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }`}</style>
        </div>
    );
}

const EmptyState = ({ msg, isDarkMode }) => (
    <div className={`h-full flex flex-col items-center justify-center rounded-xl border border-dashed ${isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-600' : 'bg-slate-50/50 border-slate-200 text-slate-400'}`}>
        <Layers className="w-10 h-10 mb-2 opacity-50" />
        <p>{msg}</p>
    </div>
);
