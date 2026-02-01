import React, { useState } from 'react';
import { Button } from './ui';

interface CropModalProps {
    initialMargins?: { left: number; top: number; right: number; bottom: number };
    onConfirm: (margins: { left: number; top: number; right: number; bottom: number }) => void;
    onCancel: () => void;
}

export const CropModal: React.FC<CropModalProps> = ({ initialMargins, onConfirm, onCancel }) => {
    const [margins, setMargins] = useState({
        left: initialMargins?.left || 5,
        top: initialMargins?.top || 5,
        right: initialMargins?.right || 5,
        bottom: initialMargins?.bottom || 5,
    });

    const handleChange = (key: keyof typeof margins, value: string) => {
        const num = parseFloat(value);
        if (!isNaN(num)) {
            setMargins(prev => ({ ...prev, [key]: num }));
        }
    };

    const handleConfirm = () => {
        onConfirm(margins);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
            <div className="w-[320px] bg-white rounded-xl shadow-xl p-6 border border-gray-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Crop Page</h3>
                <p className="text-sm text-gray-500 mb-4">Enter margins as percentages (0-100%).</p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Top (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="50"
                            value={margins.top}
                            onChange={e => handleChange('top', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Bottom (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="50"
                            value={margins.bottom}
                            onChange={e => handleChange('bottom', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Left (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="50"
                            value={margins.left}
                            onChange={e => handleChange('left', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Right (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="50"
                            value={margins.right}
                            onChange={e => handleChange('right', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button variant="primary" onClick={handleConfirm}>Crop Page</Button>
                </div>
            </div>
        </div>
    );
};
