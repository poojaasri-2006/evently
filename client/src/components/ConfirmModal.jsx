import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p style={{ marginBottom: '2rem' }}>{message}</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>Confirm</Button>
      </div>
    </Modal>
  );
};
