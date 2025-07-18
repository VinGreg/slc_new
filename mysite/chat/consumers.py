import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.meeting_id = self.scope['url_route']['kwargs']['meeting_id']
        self.room_group_name = f'chat_{self.meeting_id}'
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"WebSocket connected to room: {self.meeting_id}")
    
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )   
        
        print(f"WebSocket disconnected from meeting ID: {self.meeting_id}")
    
    async def receive(self, text_data):
        receive_dict= json.loads(text_data)
        print("receive_dict: ", receive_dict)
        message= receive_dict['message']
        action= receive_dict['action']
        
        if (action == 'new-offer') or (action == 'new-answer'):
            receiver_channel_name= receive_dict['message']['receiver_channel_name']
            receive_dict['message']['receiver_channel_name']= self.channel_name
            
            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type': 'send.sdp',
                    'receive_dict': receive_dict
                }
            )
        
            return
        
        receive_dict['message']['receiver_channel_name']= self.channel_name
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send.sdp',
                'receive_dict': receive_dict
            }
        )
        
    async def chat_message(self, event):
        message = event['message']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message
        }))    
        
    async def send_sdp(self, event):
        receive_dict= event['receive_dict']
        
        await self.send(text_data=json.dumps(receive_dict))
