'use client';

import React from 'react';
import { Card } from '@/components/common/Card';

interface Communication {
  id: string;
  status: string;
  category?: Array<{ text?: string }>;
  subject?: { reference?: string };
  about?: Array<{ reference?: string }>;
  recipient?: Array<{ reference?: string; display?: string }>;
  sender?: { reference?: string; display?: string };
  sent?: string;
  payload?: Array<{ contentString?: string }>;
  received?: string;
  extension?: Array<{
    url?: string;
    valueDateTime?: string;
  }>;
}

interface NotificationCardProps {
  comm: Communication;
  isUnread: boolean;
  senderDisplay: string;
  categoryDisplay: string;
  messageContent: string;
  icon: React.ReactNode;
  timestamp: string;
  onCardClick: () => void;
  onMarkAsRead?: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  showMarkAsRead?: boolean;
}

export function NotificationCard({
  comm,
  isUnread,
  senderDisplay,
  categoryDisplay,
  messageContent,
  icon,
  timestamp,
  onCardClick,
  onMarkAsRead,
  onDelete,
  showMarkAsRead = true,
}: NotificationCardProps) {
  const isLongMessage = messageContent.length > 150;
  const displayMessage = `${messageContent.substring(0, 150)}${isLongMessage ? '...' : ''}`;

  return (
    <div key={comm.id}>
      <Card
        className={`p-4 py-3 rounded-[5px] transition-all duration-200 cursor-pointer ${
          isUnread ? 'border-l-4 border-l-primary bg-blue-50/30' : ''
        } hover:shadow-md`}
        onClick={onCardClick}
      >
        {/* Flex container for icon and title */}
        <div className="flex items-center gap-2 mb-2">
          {/* Icon with inline-flex for SVG centering */}
          <div className="w-4 h-4 rounded-full bg-gray-100 inline-flex items-center justify-center flex-shrink-0">
            {icon}
          </div>

          {/* Sender as Title */}
          <h3 className="font-semibold text-sm text-text-primary">
            {senderDisplay}
          </h3>

          {/* Unread indicator */}
          {isUnread && (
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
          )}
        </div>

        {/* Badge inline with Message Preview */}
        <p className="font-medium text-text-primary text-sm mb-0 line-clamp-3">
          <span className="text-primary font-medium">{categoryDisplay}:</span> {displayMessage}
        </p>

        {/* Timestamp and action buttons at bottom */}
        <div className="pt-0 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-text-primary">
            {timestamp}
          </p>
          <div>
            {showMarkAsRead && isUnread && onMarkAsRead && (
              <button
                onClick={onMarkAsRead}
                className="text-xs text-primary hover:underline mr-4"
              >
                Mark as Read
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-xs text-text-secondary hover:text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
