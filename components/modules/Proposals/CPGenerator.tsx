import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Select, Badge, ProductImage, Drawer, useToast } from '../../ui';
import { Product } from '../../../types';
import { useProducts } from '../../../hooks/useProducts';
import { useObjects } from '../../../hooks/useObjects';
import { useInventoryStock } from '../../../hooks/useInventory';
import { useProposal } from '../../../hooks/useProposals';
import { useProposalMutations } from '../../../hooks/useProposalMutations';

interface CPGeneratorProps {
  profile: any;
  proposalId?: string | null;
  initialObjectId?: string | null; 
  onSuccess: () => void;
  onCancel: () => void;
}

interface CartItem {
  unique_id: string; // Temporary UI ID
  product_id: string | null; // Null for Virtual Bundle Headers
  parent_unique_id: string | null; // Hierarchy in UI
  name: string;
  description?: string;
  quantity: number;
  base_price: number; 
  retail_price: number; 
  category: string;
  unit: string;
  manual_markup_percent: number;
  is_bundle_header?: boolean;
  is_manual_price?: boolean; // New: flag to lock auto-calculation
  
  // Helpers for mapping back to DB
  db_id?: string;
  parent_db_id?: string | null;
}

const CPGenerator: React.FC<CPGeneratorProps> = ({ profile, proposalId, initialObjectId, onSuccess, onCancel }) => {
  const toast = useToast();

  // Queries
  const { data: products = [] } = useProducts();
  const { data: objects = [] } = useObjects();
  const { data: stockMap = {} } = useInventoryStock();
  const { data: proposal, isLoading: isLoadingProposal } = useProposal(proposalId || null);
  
  const { saveProposalWithItems } = useProposalMutations();

  // Settings
  const [title, setTitle] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [linkedClient, setLinkedClient] = useState<{id: string, name: string} | null>(null);
  const [hasVat, setHasVat] = useState(true);
  const [preamble, setPreamble] = useState('');
  const [footer, setFooter] = useState('');
  const [activeTab, setActiveTab] = useState<'cart' | 'text'>('cart');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null); // To know where to add items
  
  // Filters & UI
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Product Details Drawer
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Load default template for new CP
  useEffect(() => {
    if (!proposalId) {
      const fetchTemplate = async () => {
        const { data } = await supabase.from('document_templates').select('*').eq('type', 'cp').limit(1).maybeSingle();
        if (data) {
          setPreamble(data.header_text || '');
          setFooter(data.footer_text || '');
        }
      };
      fetchTemplate();
    }
  }, [proposalId]);

  // Initialize from Proposal
  useEffect(() => {
    if (proposal && products.length > 0) {
        setTitle(proposal.title || '');
        if (proposal.client) setLinkedClient(proposal.client as any);
        if (proposal.object_id) setSelectedObjectId(proposal.object_id);
        
        setHasVat(proposal.has_vat);
        setPreamble(proposal.preamble || '');
        setFooter(proposal.footer || '');

        if (proposal.items && proposal.items.length > 0) {
            const dbIdToUiId: Record<string, string> = {};
            const mappedItems: CartItem[] = proposal.items.map((i: any) => {
                const uiId = Math.random().toString(36).substr(2, 9);
                dbIdToUiId[i.id] = uiId;
                const liveProd = products.find(p => p.id === i.product_id);
                const isBundleHeader = !i.product_id;
                
                return {
                    unique_id: uiId,
                    db_id: i.id, 
                    parent_db_id: i.parent_id,
                    product_id: i.product_id,
                    name: i.snapshot_name || liveProd?.name || 'Unknown',
                    description: i.snapshot_description || '',
                    unit: i.snapshot_unit || 'шт',
                    category: i.snapshot_global_category || 'General',
                    quantity: i.quantity,
                    base_price: liveProd ? liveProd.base_price : 0,
                    retail_price: i.price_at_moment || 0,
                    manual_markup_percent: i.manual_markup || 0,
                    is_bundle_header: isBundleHeader,
                    is_manual_price: isBundleHeader, // Assume manual price for bundles loaded from DB
                    parent_unique_id: null 
                };
            });

            // Reconstruct hierarchy
            mappedItems.forEach(item => {
                if (item.parent_db_id) {
                    item.parent_unique_id = dbIdToUiId[item.parent_db_id] || null;
                }
            });

            setCart(mappedItems);
        }
    }
  }, [proposal, products]);

  // Initialize from Initial Object
  useEffect(() => {
      if (initialObjectId && !proposalId && objects.length > 0) {
          const targetObj = objects.find((o: any) => o.id === initialObjectId);
          if (targetObj) setSelectedObjectId(targetObj.id);
      }
  }, [initialObjectId, proposalId, objects]);

  // Update Client when Object changes
  useEffect(() => {
      if (selectedObjectId) {
          const obj = objects.find(o => o.id === selectedObjectId);
          if (obj && obj.client) {
              setLinkedClient(obj.client);
              // Update title if it's empty, or matches old format, or matches new format (starts with client name)
              if (!title || title.startsWith('КП для объекта') || (obj.client.name && title.startsWith(obj.client.name))) {
                  setTitle(`${obj.client.name} ${obj.name}`);
              }
          }
      }
  }, [selectedObjectId, objects]);

  // -- CALCULATIONS --
  
  // Round to 2 decimals utility
  const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

  const calculateItemPrice = (item: CartItem) => {
      let price = 0;
      if (item.is_bundle_header) {
          price = item.retail_price;
      } else if (item.base_price > 0) {
          price = item.base_price * (1 + (item.manual_markup_percent / 100));
      } else {
          price = item.retail_price; 
      }
      return roundMoney(price);
  };

  const calculateItemTotal = (item: CartItem) => {
      // Round unit price first, then multiply
      const unitPrice = calculateItemPrice(item);
      return roundMoney(unitPrice * item.quantity);
  };

  const totals = useMemo(() => {
    let subtotal = 0; let costTotal = 0;
    
    cart.forEach(i => { 
        if (!i.parent_unique_id) {
            const itemTotal = calculateItemTotal(i);
            const itemCost = roundMoney(i.base_price * i.quantity); // Cost always accumulates
            subtotal += itemTotal;
            costTotal += itemCost;
        } else {
            // It's a child. We add its cost to global cost, but its revenue is inside parent.
            costTotal += roundMoney(i.base_price * i.quantity);
        }
    });

    // Rounding sums
    subtotal = roundMoney(subtotal);
    costTotal = roundMoney(costTotal);

    const vat = hasVat ? roundMoney(subtotal * 0.2) : 0;
    const profit = roundMoney(subtotal - costTotal);
    const markupPercent = costTotal > 0 ? (profit / costTotal) * 100 : 0;
    return { subtotal, vat, total: subtotal + vat, profit, markupPercent };
  }, [cart, hasVat]);

  // Helper to recalculate a specific bundle's price based on its children
  const getBundleAutoPrice = (bundleId: string, currentCart: CartItem[]) => {
      const children = currentCart.filter(c => c.parent_unique_id === bundleId);
      const sum = children.reduce((acc, child) => {
          // Calculate child price (base + markup) * quantity
          let childUnitPrice = child.retail_price;
          if (child.base_price > 0) {
              childUnitPrice = child.base_price * (1 + (child.manual_markup_percent / 100));
          }
          // Round unit price BEFORE multiplying by quantity for bundle sum consistency
          const roundedUnitPrice = roundMoney(childUnitPrice);
          return acc + roundMoney(roundedUnitPrice * child.quantity);
      }, 0);
      return roundMoney(sum);
  };

  const addToCart = (product: Product) => {
    const newItem: CartItem = {
        unique_id: Math.random().toString(36).substr(2, 9),
        product_id: product.id,
        name: product.name,
        description: product.description || '',
        unit: product.unit,
        quantity: 1,
        base_price: product.base_price,
        retail_price: product.retail_price,
        category: product.category,
        manual_markup_percent: product.base_price > 0 
            ? parseFloat((((product.retail_price - product.base_price) / product.base_price) * 100).toFixed(2)) 
            : 0,
        parent_unique_id: activeBundleId
    };

    setCart(prev => {
        const newCart = [...prev, newItem];
        
        // Auto-update bundle price if adding to a bundle that is NOT manual
        if (activeBundleId) {
            const bundleIndex = newCart.findIndex(i => i.unique_id === activeBundleId);
            if (bundleIndex !== -1 && !newCart[bundleIndex].is_manual_price) {
                const newPrice = getBundleAutoPrice(activeBundleId, newCart);
                newCart[bundleIndex] = { ...newCart[bundleIndex], retail_price: newPrice };
            }
        }
        return newCart;
    });
  };

  const addBundleHeader = () => {
      const newItem: CartItem = {
          unique_id: Math.random().toString(36).substr(2, 9),
          product_id: null,
          name: 'Новый комплект / Решение',
          description: '',
          unit: 'компл',
          quantity: 1,
          base_price: 0,
          retail_price: 0,
          category: 'Комплекты',
          manual_markup_percent: 0,
          is_bundle_header: true,
          parent_unique_id: null,
          is_manual_price: false // Default to auto
      };
      setCart(prev => [newItem, ...prev]);
      setActiveBundleId(newItem.unique_id);
  };

  const updateCartItem = (unique_id: string, field: keyof CartItem, value: any) => {
      setCart(prev => {
          let newCart = prev.map(c => c.unique_id === unique_id ? { ...c, [field]: value } : c);
          
          // Logic 1: If updating a bundle header's price manually
          if (field === 'retail_price') {
              const item = newCart.find(c => c.unique_id === unique_id);
              if (item?.is_bundle_header) {
                  item.is_manual_price = true;
              }
          }

          // Logic 2: If updating a child item, and parent is NOT manual -> recalculate parent
          const updatedItem = newCart.find(c => c.unique_id === unique_id);
          if (updatedItem && updatedItem.parent_unique_id && (field === 'quantity' || field === 'manual_markup_percent' || field === 'retail_price')) {
              const parentId = updatedItem.parent_unique_id;
              const parentIndex = newCart.findIndex(i => i.unique_id === parentId);
              
              if (parentIndex !== -1 && !newCart[parentIndex].is_manual_price) {
                  const newParentPrice = getBundleAutoPrice(parentId, newCart);
                  newCart[parentIndex] = { ...newCart[parentIndex], retail_price: newParentPrice };
              }
          }

          return newCart;
      });
  };

  const handleRecalculateBundle = (bundleId: string) => {
      setCart(prev => {
          const newCart = [...prev];
          const bundleIndex = newCart.findIndex(i => i.unique_id === bundleId);
          if (bundleIndex !== -1) {
              const autoPrice = getBundleAutoPrice(bundleId, newCart);
              newCart[bundleIndex] = { 
                  ...newCart[bundleIndex], 
                  retail_price: autoPrice, 
                  is_manual_price: false // Reset manual flag
              };
          }
          return newCart;
      });
      toast.success('Цена комплекта пересчитана');
  };

  const removeFromCart = (unique_id: string) => {
      setCart(prev => {
          const itemToRemove = prev.find(c => c.unique_id === unique_id);
          const newCart = prev.filter(c => c.unique_id !== unique_id && c.parent_unique_id !== unique_id);
          
          // If we removed a child, update parent if auto
          if (itemToRemove && itemToRemove.parent_unique_id) {
              const parentId = itemToRemove.parent_unique_id;
              const parentIndex = newCart.findIndex(i => i.unique_id === parentId);
              if (parentIndex !== -1 && !newCart[parentIndex].is_manual_price) {
                  const newPrice = getBundleAutoPrice(parentId, newCart);
                  newCart[parentIndex] = { ...newCart[parentIndex], retail_price: newPrice };
              }
          }
          return newCart;
      });
      if (activeBundleId === unique_id) setActiveBundleId(null);
  };

  const handleSave = async () => {
    if (!linkedClient) { toast.error('Выберите объект с клиентом'); return; }
    if (cart.length === 0) { toast.error('Корзина пуста'); return; }
    
    try {
      const headerPayload = {
        title: title || null,
        client_id: linkedClient.id,
        object_id: selectedObjectId || null,
        status: 'draft',
        exchange_rate: 1, 
        has_vat: hasVat,
        total_amount_byn: totals.total,
        created_by: profile.id,
        preamble: preamble || null,
        footer: footer || null
      };

      // Prepare items with calculated prices
      const itemsToSave = cart.map(item => ({
          ...item,
          final_price_byn: calculateItemTotal(item) / item.quantity,
          price_at_moment: calculateItemPrice(item),
      }));

      await saveProposalWithItems.mutateAsync({
          header: headerPayload,
          items: itemsToSave,
          cpId: proposalId || undefined
      });
      
      onSuccess();
    } catch (e: any) { 
        // Error handled in mutation
    }
  };

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach(p => {
        const match = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
        if (match) {
            const cat = p.category || 'Без категории';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(p);
        }
    });
    return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
  }, [products, search]);

  const toggleCategory = (cat: string) => {
      setExpandedCategories(prev => {
          const next = new Set(prev);
          if (next.has(cat)) next.delete(cat); else next.add(cat);
          return next;
      });
  };

  const renderCartItems = () => {
      const roots = cart.filter(c => !c.parent_unique_id);
      const output: CartItem[] = [];
      roots.forEach(r => {
          output.push(r);
          const children = cart.filter(c => c.parent_unique_id === r.unique_id);
          output.push(...children);
      });
      return output;
  };

  const isSaving = saveProposalWithItems.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[600px] gap-4">
      
      {/* Top Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-4 items-end shrink-0 shadow-sm">
        <div className="w-64">
            <Select label="Объект" value={selectedObjectId} onChange={(e:any) => setSelectedObjectId(e.target.value)} options={[{value:'', label:'Выберите объект...'}, ...objects.map(o => ({value:o.id, label:o.name}))]} icon="home_work" disabled={!!initialObjectId} />
        </div>
        <div className="flex-grow min-w-[200px] flex flex-col justify-end">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Заказчик</p>
            <div className={`h-[46px] px-4 rounded-xl border flex items-center transition-all ${linkedClient ? 'bg-blue-50 border-blue-200 text-blue-900 font-bold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                <span className="material-icons-round text-lg mr-2">{linkedClient ? 'person' : 'no_accounts'}</span>
                {linkedClient ? linkedClient.name : '—'}
            </div>
        </div>
        <div className="w-64"><Input label="Название КП" placeholder="Напр: Смета на оборудование" value={title} onChange={(e:any) => setTitle(e.target.value)} /></div>
        <div className="pb-3 px-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasVat} onChange={(e) => setHasVat(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-bold text-slate-700">НДС 20%</span>
          </label>
        </div>
        <div className="ml-auto flex gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1 mr-2">
            <button 
              onClick={() => setActiveTab('cart')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'cart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Смета
            </button>
            <button 
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Оформление
            </button>
          </div>
          <Button variant="ghost" onClick={onCancel}>Отмена</Button>
          <Button icon="save" onClick={handleSave} loading={isSaving}>Сохранить</Button>
        </div>
      </div>

      {activeTab === 'text' ? (
        <div className="flex-grow bg-white rounded-2xl border border-slate-200 p-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Вступительный текст</h3>
              <p className="text-xs text-slate-500 mb-3">Этот текст будет отображаться перед таблицей товаров. Поддерживаются теги: {'{{client_name}}'}, {'{{legal_name}}'}, {'{{rep_position_nom}}'}, {'{{rep_name_nom}}'}, {'{{unp}}'}, {'{{bank_details}}'}</p>
              <textarea 
                value={preamble}
                onChange={(e) => setPreamble(e.target.value)}
                className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm leading-relaxed"
                placeholder="Уважаемый клиент..."
              />
            </div>
            
            <div className="border-t border-slate-100 pt-8">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Заключительный текст / Условия</h3>
              <p className="text-xs text-slate-500 mb-3">Этот текст будет отображаться после итогов. Поддерживаются теги: {'{{client_name}}'}, {'{{legal_name}}'}, {'{{rep_position_nom}}'}, {'{{rep_name_nom}}'}, {'{{unp}}'}, {'{{bank_details}}'}</p>
              <textarea 
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm leading-relaxed"
                placeholder="1. Оплата производится в рублях по курсу НБРБ..."
              />
            </div>
          </div>
        </div>
      ) : (
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-10 gap-4 overflow-hidden h-full min-h-0">
        {/* Left: Catalog */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden h-full min-h-0">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50">
            <Input placeholder="Поиск товара..." value={search} onChange={(e:any) => setSearch(e.target.value)} className="flex-grow" icon="search" />
            {activeBundleId && (
                <div className="flex items-center justify-between bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-xs">
                    <span className="font-bold flex items-center gap-2"><span className="material-icons-round text-sm">folder_open</span> Режим наполнения комплекта</span>
                    <button onClick={() => setActiveBundleId(null)} className="font-bold hover:underline">Завершить</button>
                </div>
            )}
          </div>
          <div className="flex-grow overflow-y-auto">
            {groupedCatalog.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Товары не найдены</div>
            ) : (
                groupedCatalog.map(([cat, items]) => {
                    const isExpanded = expandedCategories.has(cat) || search.length > 0;
                    
                    return (
                        <div key={cat} className="border-b border-slate-100 last:border-0">
                            <div 
                                onClick={() => toggleCategory(cat)}
                                className="bg-white hover:bg-slate-50 px-4 py-2 cursor-pointer flex items-center justify-between transition-colors sticky top-0 z-10 backdrop-blur-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`material-icons-round text-slate-400 transition-transform ${isExpanded ? '-rotate-90' : ''}`}>expand_more</span>
                                    <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{cat}</span>
                                </div>
                                <Badge color="slate">{items.length}</Badge>
                            </div>
                            
                            {isExpanded && (
                                <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                    {items.map(p => {
                                        const stockQty = stockMap[p.id] || 0;
                                        return (
                                            <div key={p.id} onClick={() => addToCart(p)} className="p-3 hover:bg-blue-50/30 cursor-pointer transition-colors flex justify-between items-center group">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <ProductImage src={p.image_url} alt={p.name} className="w-9 h-9 rounded-md shrink-0 border border-slate-100" preview />
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setViewingProduct(p); }}
                                                                className="w-5 h-5 rounded-full hover:bg-blue-100 text-slate-300 hover:text-blue-600 flex items-center justify-center transition-colors shrink-0"
                                                                title="Подробнее о товаре"
                                                            >
                                                                <span className="material-icons-round text-[16px]">info</span>
                                                            </button>
                                                        </div>
                                                        {p.sku && <span className="text-[10px] text-slate-500 font-mono">{p.sku}</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right pl-2 shrink-0">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.retail_price} BYN</span>
                                                        <span className={`text-[9px] mt-1 font-bold ${stockQty > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>Склад: {stockQty}</span>
                                                    </div>
                                                </div>
                                                {activeBundleId && (
                                                    <div className="absolute inset-y-0 right-0 bg-blue-100/50 w-1 opacity-0 group-hover:opacity-100"></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden h-full min-h-0 shadow-sm relative">
          <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-icons-round text-slate-400">shopping_cart</span>
              Смета ({cart.length})
            </h3>
            <Button variant="tonal" className="h-8 text-xs" icon="create_new_folder" onClick={addBundleHeader}>Добавить комплект</Button>
          </div>
          
          <div className="flex-grow overflow-y-auto p-2 space-y-1 bg-white">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30">
                  <span className="material-icons-round text-6xl mb-2">playlist_add</span>
                  <p className="text-center text-sm">Добавьте товары или создайте комплект</p>
              </div>
            ) : (
                renderCartItems().map(item => {
                    const isBundle = item.is_bundle_header;
                    const isChild = !!item.parent_unique_id;
                    const isActiveBundle = activeBundleId === item.unique_id;

                    return (
                        <div 
                            key={item.unique_id} 
                            className={`
                                relative p-2 rounded-xl border transition-all group
                                ${isBundle ? 'bg-indigo-50 border-indigo-100 mb-2 mt-2' : 'bg-white border-slate-100'}
                                ${isChild ? 'ml-6 border-l-4 border-l-indigo-200' : ''}
                                ${isActiveBundle ? 'ring-2 ring-indigo-400' : ''}
                            `}
                            onClick={() => isBundle && setActiveBundleId(isActiveBundle ? null : item.unique_id)}
                        >
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex items-start gap-2 flex-grow">
                                    {isBundle && (
                                        <span className={`material-icons-round text-lg mt-0.5 ${isActiveBundle ? 'text-indigo-600' : 'text-indigo-300'}`}>
                                            {isActiveBundle ? 'folder_open' : 'folder'}
                                        </span>
                                    )}
                                    <div className="w-full">
                                        {isBundle ? (
                                            <input 
                                                className="w-full bg-transparent font-bold text-indigo-900 outline-none placeholder:text-indigo-300"
                                                value={item.name}
                                                onChange={(e) => updateCartItem(item.unique_id, 'name', e.target.value)}
                                                placeholder="Название комплекта"
                                            />
                                        ) : (
                                            <p className="text-xs font-medium text-slate-800 leading-tight">{item.name}</p>
                                        )}
                                        {!isBundle && <p className="text-[9px] text-slate-400 mt-0.5">{item.unit}</p>}
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.unique_id); }} className="text-slate-300 hover:text-red-500 transition-colors">
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-2 pl-7">
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg h-8 shadow-sm overflow-hidden">
                                    <input 
                                        type="number" min="1" 
                                        value={item.quantity} 
                                        onChange={(e) => updateCartItem(item.unique_id, 'quantity', parseInt(e.target.value) || 1)} 
                                        className="w-12 h-full text-center text-xs font-bold bg-white text-slate-900 outline-none border-r border-slate-100"
                                    />
                                    <span className="text-[10px] text-slate-500 font-medium px-2 bg-slate-50 h-full flex items-center">{item.unit}</span>
                                </div>

                                {/* Price / Markup Input */}
                                {item.is_bundle_header ? (
                                    <div className="flex items-center gap-1">
                                        <div className={`flex items-center border border-slate-200 rounded-lg h-8 px-2 shadow-sm gap-2 transition-colors ${item.is_manual_price ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Цена:</span>
                                            <input 
                                                type="number" 
                                                value={item.retail_price}
                                                onChange={(e) => updateCartItem(item.unique_id, 'retail_price', parseFloat(e.target.value) || 0)}
                                                className={`w-24 text-right text-sm font-bold bg-transparent outline-none placeholder:text-slate-300 ${item.is_manual_price ? 'text-amber-800' : 'text-slate-900'}`}
                                                placeholder="0.00"
                                            />
                                            <span className="text-[10px] font-bold text-slate-400">BYN</span>
                                        </div>
                                        {item.is_manual_price && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleRecalculateBundle(item.unique_id); }}
                                                className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors shadow-sm"
                                                title="Пересчитать автоматически"
                                            >
                                                <span className="material-icons-round text-sm">calculate</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg h-8 px-1 shadow-sm">
                                        <input 
                                            type="number" step="0.1"
                                            value={item.manual_markup_percent}
                                            onChange={(e) => updateCartItem(item.unique_id, 'manual_markup_percent', parseFloat(e.target.value) || 0)}
                                            className={`w-12 text-center text-xs font-bold bg-white outline-none ${item.manual_markup_percent < 0 ? 'text-red-500' : 'text-emerald-600'}`}
                                        />
                                        <span className="text-[10px] text-slate-400 pr-1">%</span>
                                    </div>
                                )}

                                <div className="ml-auto flex flex-col items-end">
                                    <span className="font-bold text-sm text-slate-800">{calculateItemTotal(item).toFixed(2)} BYN</span>
                                    {!item.is_bundle_header && (
                                        <span className="text-[9px] text-slate-400">Сумма</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
          </div>

          <div className="bg-slate-50 border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] shrink-0 sticky bottom-0 z-20">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-slate-500 font-bold uppercase">Итого</span>
              <span className="font-bold text-xl text-blue-600">{totals.total.toFixed(2)} BYN</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
                <span>Без НДС: {totals.subtotal.toFixed(2)}</span>
                <span>Прибыль: {totals.profit.toFixed(2)} ({totals.markupPercent.toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      </div>

      )}

      <Drawer isOpen={!!viewingProduct} onClose={() => setViewingProduct(null)} title="Карточка товара" width="max-w-md">
        {viewingProduct && (
            <div className="space-y-6">
                <div className="flex justify-center bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <ProductImage src={viewingProduct.image_url} className="w-48 h-48 object-contain" preview />
                </div>
                
                <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">{viewingProduct.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {viewingProduct.sku && <Badge color="slate">SKU: {viewingProduct.sku}</Badge>}
                        <Badge color="blue">{viewingProduct.category}</Badge>
                        <Badge color="emerald">{viewingProduct.unit}</Badge>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Базовая цена</p>
                        <p className="text-lg font-bold text-slate-700">{viewingProduct.base_price} BYN</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Розница</p>
                        <p className="text-lg font-bold text-blue-600">{viewingProduct.retail_price} BYN</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-sm text-slate-500">Производитель</span>
                        <span className="text-sm font-medium">{viewingProduct.manufacturer || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-sm text-slate-500">Страна</span>
                        <span className="text-sm font-medium">{viewingProduct.origin_country || '—'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-sm text-slate-500">Вес</span>
                        <span className="text-sm font-medium">{viewingProduct.weight ? `${viewingProduct.weight} кг` : '—'}</span>
                    </div>
                </div>

                {viewingProduct.description && (
                    <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Описание</p>
                        <p className="text-sm text-slate-600 italic leading-relaxed">{viewingProduct.description}</p>
                    </div>
                )}

                <Button 
                    onClick={() => { addToCart(viewingProduct); setViewingProduct(null); }} 
                    className="w-full h-12"
                    icon="add_shopping_cart"
                >
                    Добавить в смету
                </Button>
            </div>
        )}
      </Drawer>
    </div>
  );
};

export default CPGenerator;
