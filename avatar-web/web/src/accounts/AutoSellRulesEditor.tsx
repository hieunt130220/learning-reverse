import { useMemo, useState } from 'react';

import type { AutoSellRuleDto, ShopPriceRule } from '../types.js';

export interface AutoSellRulesEditorProps {
  autoSellProduce: boolean;
  autoSellRules: AutoSellRuleDto[];
  priceRules: ShopPriceRule[];
  produceItems: { id: number; num: number }[];
  nameById: Map<number, string>;
  disabled?: boolean;
  onChange(patch: {
    autoSellProduce?: boolean;
    autoSellRules?: AutoSellRuleDto[];
  }): void;
}

export function AutoSellRulesEditor({
  autoSellProduce,
  autoSellRules,
  priceRules,
  produceItems: _produceItems,
  nameById,
  disabled = false,
  onChange,
}: AutoSellRulesEditorProps) {
  // Map itemId -> priceRule for fast lookup
  const priceRulesMap = useMemo(() => {
    const map = new Map<number, ShopPriceRule>();
    for (const rule of priceRules) {
      map.set(rule.itemId, rule);
    }
    return map;
  }, [priceRules]);

  // Set of existing itemIds in autoSellRules
  const existingItemIds = useMemo(() => {
    return new Set(autoSellRules.map((r) => r.itemId));
  }, [autoSellRules]);

  // Available items in priceRules that are NOT already in autoSellRules
  const availablePriceRules = useMemo(() => {
    return priceRules.filter((pr) => !existingItemIds.has(pr.itemId));
  }, [priceRules, existingItemIds]);

  // Form state for adding new rule
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [priceInput, setPriceInput] = useState<string>('');

  // Auto-fill default price (minPrice) when selecting item
  const handleSelectItem = (idNum: number | '') => {
    setSelectedItemId(idNum);
    if (typeof idNum === 'number') {
      const pr = priceRulesMap.get(idNum);
      if (pr) {
        setPriceInput(pr.minPrice.toString());
      }
    } else {
      setPriceInput('');
    }
  };

  // Price rule for currently selected item
  const selectedPriceRule = typeof selectedItemId === 'number' ? priceRulesMap.get(selectedItemId) : undefined;

  // Validation for new rule inputs
  const parsedQuantity = parseInt(quantityInput, 10);
  const parsedPrice = parseInt(priceInput, 10);

  const isQuantityValid = !isNaN(parsedQuantity) && parsedQuantity > 0 && Number.isInteger(parsedQuantity);
  const isPriceValid = !isNaN(parsedPrice) && parsedPrice > 0 && Number.isInteger(parsedPrice);

  const isPriceOutOfRange =
    selectedPriceRule !== undefined &&
    isPriceValid &&
    (parsedPrice < selectedPriceRule.minPrice || parsedPrice > selectedPriceRule.maxPrice);

  const canAddRule =
    !disabled &&
    typeof selectedItemId === 'number' &&
    isQuantityValid &&
    isPriceValid &&
    !isPriceOutOfRange;

  // Handle adding new rule
  const handleAddRule = () => {
    if (!canAddRule || typeof selectedItemId !== 'number') return;
    const newRule: AutoSellRuleDto = {
      itemId: selectedItemId,
      quantity: parsedQuantity,
      price: parsedPrice,
    };
    const nextRules = [...autoSellRules, newRule];
    onChange({ autoSellRules: nextRules });

    // Reset add form
    setSelectedItemId('');
    setQuantityInput('1');
    setPriceInput('');
  };

  // Reorder rule up/down
  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    if (disabled) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= autoSellRules.length) return;

    const nextRules = [...autoSellRules];
    const [moved] = nextRules.splice(index, 1);
    nextRules.splice(targetIndex, 0, moved);
    onChange({ autoSellRules: nextRules });
  };

  // Delete rule
  const handleDeleteRule = (index: number) => {
    if (disabled) return;
    const nextRules = autoSellRules.filter((_, i) => i !== index);
    onChange({ autoSellRules: nextRules });
  };

  return (
    <div className="auto-sell-rules-editor">
      <div className="auto-sell-header-controls">
        <label className="auto-sell-checkbox-label">
          <input
            type="checkbox"
            checked={autoSellProduce}
            disabled={disabled}
            onChange={(e) => onChange({ autoSellProduce: e.target.checked })}
          />
          <span>Tự động bán trên sạp</span>
        </label>
      </div>

      {priceRules.length === 0 ? (
        <div className="auto-sell-warning-notice">
          Hãy kết nối và đồng bộ sạp để lấy price rules trước khi cấu hình
        </div>
      ) : (
        <>
          <div className="auto-sell-rules-table-container">
            <table className="auto-sell-rules-table">
              <thead>
                <tr>
                  <th>Nông sản</th>
                  <th>Số lượng một lô</th>
                  <th>Giá bán</th>
                  <th className="misc-th-action">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {autoSellRules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="auto-sell-empty-text table-empty-row">
                      Chưa có quy tắc nào
                    </td>
                  </tr>
                ) : (
                  autoSellRules.map((rule, idx) => {
                    const itemName = nameById.get(rule.itemId) ?? `Vật phẩm #${rule.itemId}`;
                    const pr = priceRulesMap.get(rule.itemId);
                    const priceRangeText = pr ? `(Min: ${pr.minPrice.toLocaleString()} - Max: ${pr.maxPrice.toLocaleString()})` : '';

                    return (
                      <tr key={rule.itemId}>
                        <td data-label="Nông sản">
                          <strong>{itemName}</strong>
                        </td>
                        <td data-label="Số lượng một lô">{rule.quantity.toLocaleString()}</td>
                        <td data-label="Giá bán">
                          {rule.price.toLocaleString()} <span className="auto-sell-price-range">{priceRangeText}</span>
                        </td>
                        <td data-label="Hành động" className="auto-sell-actions-cell">
                          <button
                            type="button"
                            className="auto-sell-btn-icon"
                            title="Đẩy lên"
                            disabled={disabled || idx === 0}
                            onClick={() => handleMoveRule(idx, 'up')}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="auto-sell-btn-icon"
                            title="Đẩy xuống"
                            disabled={disabled || idx === autoSellRules.length - 1}
                            onClick={() => handleMoveRule(idx, 'down')}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            className="auto-sell-btn-icon auto-sell-btn-delete"
                            title="Xóa"
                            disabled={disabled}
                            onClick={() => handleDeleteRule(idx)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="auto-sell-add-form">
            <div className="auto-sell-add-form-title">Thêm quy tắc mới:</div>
            <div className="auto-sell-add-form-row">
              <select
                className="auto-sell-select-item"
                value={selectedItemId}
                disabled={disabled || availablePriceRules.length === 0}
                onChange={(e) => {
                  const val = e.target.value;
                  handleSelectItem(val === '' ? '' : parseInt(val, 10));
                }}
              >
                <option value="">-- Chọn nông sản --</option>
                {availablePriceRules.map((pr) => {
                  const name = nameById.get(pr.itemId) ?? `Vật phẩm #${pr.itemId}`;
                  return (
                    <option key={pr.itemId} value={pr.itemId}>
                      {name} (Min: {pr.minPrice} - Max: {pr.maxPrice})
                    </option>
                  );
                })}
              </select>

              <div className="auto-sell-add-field">
                <label>Số lượng:</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="auto-sell-input-num"
                  placeholder="Số lượng"
                  value={quantityInput}
                  disabled={disabled || typeof selectedItemId !== 'number'}
                  onChange={(e) => setQuantityInput(e.target.value)}
                />
              </div>

              <div className="auto-sell-add-field">
                <label>Giá bán:</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="auto-sell-input-num"
                  placeholder="Giá bán"
                  value={priceInput}
                  disabled={disabled || typeof selectedItemId !== 'number'}
                  onChange={(e) => setPriceInput(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="auto-sell-btn-add"
                disabled={!canAddRule}
                onClick={handleAddRule}
              >
                Thêm quy tắc
              </button>
            </div>

            {selectedPriceRule && (
              <div className="auto-sell-price-hint">
                Dải giá cho phép: Min <strong>{selectedPriceRule.minPrice.toLocaleString()}</strong> - Max{' '}
                <strong>{selectedPriceRule.maxPrice.toLocaleString()}</strong>
                {isPriceOutOfRange && (
                  <span className="auto-sell-price-error">
                    {' '}
                    (Giá nhập ngoài khoảng quy định!)
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
