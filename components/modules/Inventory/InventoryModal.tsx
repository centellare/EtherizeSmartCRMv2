
import React from 'react';
import { Modal } from '../../ui';
import { Product, InventoryItem } from '../../../types';
import { CartItem } from './index';
import { ItemForm } from './modals/ItemForm';
import { DeployForm } from './modals/DeployForm';
import { ReturnForm } from './modals/ReturnForm';
import { ReplaceForm } from './modals/ReplaceForm';
import { DeployInvoiceForm } from './modals/DeployInvoiceForm';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add_item' | 'deploy_item' | 'replace_item' | 'edit_item' | 'return_item' | 'receive_supply' | 'deploy_invoice';
  products?: Product[];
  objects: any[];
  items: InventoryItem[];
  selectedItem: any | null;
  cartItems?: CartItem[];
  profile: any;
  onSuccess: (keepOpen?: boolean) => void;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ 
  isOpen, onClose, mode, products, objects, items, selectedItem, cartItems = [], profile, onSuccess 
}) => {
  const isBulkDeploy = mode === 'deploy_item' && cartItems.length > 0 && !selectedItem;

  const getTitle = () => {
      switch(mode) {
          case 'add_item': return 'Приемка на склад';
          case 'receive_supply': return 'Приемка заказа (из дефицита)';
          case 'edit_item': return 'Корректировка партии';
          case 'deploy_item': return isBulkDeploy ? `Массовая отгрузка (${cartItems.length} поз.)` : 'Отгрузка на объект';
          case 'replace_item': return 'Гарантийная замена';
          case 'return_item': return 'Возврат на склад';
          case 'deploy_invoice': return 'Сборка и отгрузка по Счету';
      }
  };

  const handleSuccess = (keepOpen = false) => {
      onSuccess(keepOpen);
      if (!keepOpen) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
        {(mode === 'add_item' || mode === 'edit_item' || mode === 'receive_supply') && (
            <ItemForm 
                mode={mode} 
                selectedItem={selectedItem} 
                products={products} 
                profile={profile} 
                onSuccess={handleSuccess} 
            />
        )}

        {mode === 'deploy_item' && (
             <DeployForm 
                selectedItem={selectedItem}
                cartItems={cartItems}
                // @ts-ignore
                catalog={products} 
                items={items}
                objects={objects}
                profile={profile}
                onSuccess={() => handleSuccess()}
             />
        )}

        {mode === 'deploy_invoice' && (
            <DeployInvoiceForm 
                profile={profile}
                onSuccess={() => handleSuccess()}
                onClose={onClose}
            />
        )}

        {mode === 'return_item' && selectedItem && (
            <ReturnForm 
                selectedItem={selectedItem}
                objects={objects}
                profile={profile}
                onSuccess={() => handleSuccess()}
                onCancel={onClose}
            />
        )}

        {mode === 'replace_item' && selectedItem && (
             <ReplaceForm 
                selectedItem={selectedItem}
                items={items}
                profile={profile}
                onSuccess={() => handleSuccess()}
             />
        )}
    </Modal>
  );
};

export default InventoryModal;
