
import React, { useEffect, useState } from 'react';
import { Modal } from '../../ui';
import { InventoryCatalogItem, InventoryItem } from '../../../types';
import { CartItem } from './index';
import { CatalogForm } from './modals/CatalogForm';
import { ItemForm } from './modals/ItemForm';
import { DeployForm } from './modals/DeployForm';
import { ReturnForm } from './modals/ReturnForm';
import { ReplaceForm } from './modals/ReplaceForm';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create_catalog' | 'add_item' | 'deploy_item' | 'replace_item' | 'edit_catalog' | 'edit_item' | 'return_item';
  catalog: InventoryCatalogItem[];
  objects: any[];
  items: InventoryItem[]; // All items for replacement logic
  selectedItem: any | null; // Can be InventoryItem or CatalogItem depending on mode
  cartItems?: CartItem[]; // New prop for bulk actions
  profile: any;
  onSuccess: (keepOpen?: boolean) => void;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ 
  isOpen, onClose, mode, catalog, objects, items, selectedItem, cartItems = [], profile, onSuccess 
}) => {
  const isBulkDeploy = mode === 'deploy_item' && cartItems.length > 0 && !selectedItem;

  const getTitle = () => {
      switch(mode) {
          case 'create_catalog': return 'Новый тип оборудования';
          case 'edit_catalog': return 'Редактирование справочника';
          case 'add_item': return 'Приемка на склад';
          case 'edit_item': return 'Корректировка партии';
          case 'deploy_item': return isBulkDeploy ? `Массовая отгрузка (${cartItems.length} поз.)` : 'Отгрузка на объект';
          case 'replace_item': return 'Гарантийная замена';
          case 'return_item': return 'Возврат на склад';
      }
  };

  const handleSuccess = (keepOpen = false) => {
      onSuccess(keepOpen);
      if (!keepOpen) {
          onClose();
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
        {(mode === 'create_catalog' || mode === 'edit_catalog') && (
            <CatalogForm 
                mode={mode} 
                selectedItem={selectedItem} 
                onSuccess={() => handleSuccess()} 
            />
        )}

        {(mode === 'add_item' || mode === 'edit_item') && (
            <ItemForm 
                mode={mode} 
                selectedItem={selectedItem} 
                catalog={catalog} 
                profile={profile} 
                onSuccess={handleSuccess} 
            />
        )}

        {mode === 'deploy_item' && (selectedItem || isBulkDeploy) && (
             <DeployForm 
                selectedItem={selectedItem}
                cartItems={cartItems}
                catalog={catalog}
                items={items}
                objects={objects}
                profile={profile}
                onSuccess={() => handleSuccess()}
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
