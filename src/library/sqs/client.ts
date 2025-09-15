import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { BookingRequest } from '@/types/sqs';
import { v4 as uuidv4 } from 'uuid';

// Check if we should use mock SQS
const useMockSQS = process.env.USE_MOCK_SQS === 'true';

// Initialize SQS client
const sqsClient = useMockSQS ? null : new SQSClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const QUEUE_URL = process.env.SQS_QUEUE_URL || '';
const DLQ_URL = process.env.SQS_DLQ_URL || '';

// Mock storage for development
const mockQueue: Map<string, BookingRequest> = new Map();

export class SQSService {
  /**
   * Send a booking request to the SQS queue
   * This should be called after preparing the booking request data
   */
  static async sendBookingRequest(request: Omit<BookingRequest, 'requestId' | 'timestamp'>): Promise<string> {
    const bookingRequest: BookingRequest = {
      ...request,
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    if (useMockSQS) {
      // Mock implementation for development
      mockQueue.set(bookingRequest.requestId, bookingRequest);
      console.log('Mock SQS: Booking request queued', bookingRequest);
      return bookingRequest.requestId;
    }

    if (!sqsClient || !QUEUE_URL) {
      throw new Error('SQS not configured properly');
    }

    const messageGroupId = `${request.practitionerId}_${request.slotStart}`;
    
    const command = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(bookingRequest),
      MessageGroupId: messageGroupId,
      MessageDeduplicationId: bookingRequest.requestId,
    });

    try {
      await sqsClient.send(command);
      return bookingRequest.requestId;
    } catch (error) {
      console.error('Error sending message to SQS:', error);
      throw new Error('Failed to submit booking request');
    }
  }

  /**
   * Receive booking requests from the SQS queue (for providers)
   */
  static async receiveBookingRequests(practitionerId?: string): Promise<Array<{
    request: BookingRequest;
    receiptHandle: string;
  }>> {
    if (useMockSQS) {
      // Mock implementation for development
      const requests = Array.from(mockQueue.values())
        .filter(req => !practitionerId || req.practitionerId === practitionerId)
        .map(request => ({
          request,
          receiptHandle: request.requestId, // Use requestId as receipt handle in mock
        }));
      return requests;
    }

    if (!sqsClient || !QUEUE_URL) {
      throw new Error('SQS not configured properly');
    }

    const command = new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Long polling
      VisibilityTimeout: 300, // 5 minutes
    });

    try {
      const response = await sqsClient.send(command);
      const messages = response.Messages || [];
      
      return messages
        .map(message => {
          try {
            const request: BookingRequest = JSON.parse(message.Body || '{}');
            // Filter by practitioner if specified
            if (practitionerId && request.practitionerId !== practitionerId) {
              return null;
            }
            return {
              request,
              receiptHandle: message.ReceiptHandle || '',
            };
          } catch {
            return null;
          }
        })
        .filter((item): item is { request: BookingRequest; receiptHandle: string } => item !== null);
    } catch (error) {
      console.error('Error receiving messages from SQS:', error);
      throw new Error('Failed to retrieve booking requests');
    }
  }


  /**
   * Delete a booking request from the queue (after processing)
   */
  static async deleteBookingRequest(receiptHandle: string): Promise<void> {
    if (useMockSQS) {
      // Mock implementation for development
      mockQueue.delete(receiptHandle); // In mock, receiptHandle is the requestId
      console.log('Mock SQS: Booking request deleted', receiptHandle);
      return;
    }

    if (!sqsClient || !QUEUE_URL) {
      throw new Error('SQS not configured properly');
    }

    const command = new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle,
    });

    try {
      await sqsClient.send(command);
    } catch (error) {
      console.error('Error deleting message from SQS:', error);
      throw new Error('Failed to delete booking request');
    }
  }
}

// Export individual functions for convenience
export const sendBookingRequest = SQSService.sendBookingRequest;
export const receiveBookingRequests = SQSService.receiveBookingRequests;
export const deleteBookingRequest = SQSService.deleteBookingRequest;