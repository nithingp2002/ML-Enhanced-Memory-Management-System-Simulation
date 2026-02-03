import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report

class LSTMModel(nn.Module):
    def __init__(self, input_size, hidden_size, output_size, embedding_dim=32):
        super(LSTMModel, self).__init__()
        self.embedding = nn.Embedding(input_size, embedding_dim)
        self.lstm = nn.LSTM(embedding_dim, hidden_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)
        
    def forward(self, x):
        # x shape: (batch_size, sequence_length)
        x = self.embedding(x)
        # x shape: (batch_size, sequence_length, embedding_dim)
        out, _ = self.lstm(x)
        # Take the output of the last time step
        out = out[:, -1, :]
        out = self.fc(out)
        return out

class LSTMPredictor:
    """
    LSTM Predictor for Page Replacement
    ===================================
    PyTorch LSTM with proper ML Pipeline
    
    Pipeline:
    1. Data Loading
    2. Data Preprocessing (LabelEncoder, Windowing)
    3. Train/Test Split
    4. Model Building (PyTorch LSTM)
    5. Training
    6. Evaluation
    """
    def __init__(self, frame_count=4, sequence_length=5, test_size=0.2):
        # ============ HYPERPARAMETERS ============
        self.frame_count = frame_count
        self.sequence_length = sequence_length
        self.test_size = test_size
        self.hidden_size = 64
        self.embedding_dim = 32
        self.learning_rate = 0.01
        self.epochs = 10
        
        # ============ PREPROCESSING ============
        self.label_encoder = LabelEncoder()
        self.vocab_size = 100 # Default/Initial
        
        # ============ MODEL (PyTorch) ============
        self.model = None
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = None
        
        # ============ DATA STORAGE ============
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.history = []
        self.classes_ = []
        
        # ============ MEMORY STATE ============
        self.frames = [None] * frame_count
        self.frame_metadata = [
            {'page': None, 'load_time': 0, 'last_access': 0, 'access_count': 0}
            for _ in range(frame_count)
        ]
        
        # ============ TRAINING STATE ============
        self.is_fitted = False
        
        # ============ EVALUATION METRICS ============
        self.train_loss = 0.0
        self.train_accuracy = 0.0
        self.test_accuracy = 0.0
        self.page_faults = 0
        self.page_hits = 0
        self.correct_predictions = 0
        self.total_predictions = 0
        self.last_prediction = None
        self.current_time = 0

    # ================================================
    # STEP 1: DATA LOADING
    # ================================================
    def load_data(self, sequences):
        """
        Load data from sequences
        """
        print("Step 1: Loading Data...")
        # Flatten for vocabulary building
        all_pages = []
        for seq in sequences:
            if isinstance(seq[0], dict):
                # Handle dict format if present
                seq_pages = [s.get('pageNumber', 0) for s in seq]
            else:
                seq_pages = seq
            all_pages.extend(seq_pages)
            
        print(f"   Total accesses: {len(all_pages)}")
        return sequences

    # ================================================
    # STEP 2: DATA PREPROCESSING
    # ================================================
    def preprocess_data(self, sequences):
        """
        Create sliding windows and encode labels
        """
        print("Step 2: Preprocessing (Windowing & Encoding)...")
        
        # 1. Fit Label Encoder
        all_pages = set()
        cleaned_search_sequences = [] # Store clean integer sequences
        
        for seq in sequences:
            clean_seq = []
            for item in seq:
                if isinstance(item, dict):
                    page = item.get('pageNumber', 0)
                else:
                    page = int(item)
                clean_seq.append(page)
                all_pages.add(page)
            cleaned_search_sequences.append(clean_seq)
            
        # Add buffer for potential new pages
        all_pages_list = sorted(list(all_pages))
        self.label_encoder.fit(all_pages_list)
        self.vocab_size = len(all_pages_list) + 1 # +1 for unknown tokens safety
        self.classes_ = self.label_encoder.classes_
        
        print(f"   Vocabulary Size: {self.vocab_size}")
        
        X_data = []
        y_data = []
        
        for seq in cleaned_search_sequences:
            if len(seq) > self.sequence_length:
                # Transform to indices
                encoded_seq = self.label_encoder.transform(seq)
                
                # Create sliding windows
                for i in range(len(encoded_seq) - self.sequence_length):
                    window = encoded_seq[i : i + self.sequence_length]
                    target = encoded_seq[i + self.sequence_length]
                    X_data.append(window)
                    y_data.append(target)
                    
        print(f"   Created {len(X_data)} training samples")
        
        return np.array(X_data), np.array(y_data)

    # ================================================
    # STEP 3: TRAIN/TEST SPLIT
    # ================================================
    def split_data(self, X, y):
        """
        Split data into train and test sets
        """
        print(f"Step 3: Train/Test Split (test_size={self.test_size})...")
        
        if len(X) < 10: # Too small to split effectively
             X_train, X_test, y_train, y_test = X, X, y, y
        else:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=self.test_size, random_state=42
            )
            
        # Convert to PyTorch tensors
        self.X_train = torch.tensor(X_train, dtype=torch.long)
        self.X_test = torch.tensor(X_test, dtype=torch.long)
        self.y_train = torch.tensor(y_train, dtype=torch.long)
        self.y_test = torch.tensor(y_test, dtype=torch.long)
        
        print(f"   Training samples: {len(self.X_train)}")
        print(f"   Testing samples: {len(self.X_test)}")
        
        return self.X_train, self.X_test, self.y_train, self.y_test

    # ================================================
    # STEP 4: MODEL BUILDING
    # ================================================
    def build_model(self):
        """
        Initialize the LSTM model
        """
        print("Step 4: Building Model (PyTorch LSTM)...")
        
        self.model = LSTMModel(
            input_size=self.vocab_size,
            hidden_size=self.hidden_size,
            output_size=self.vocab_size,
            embedding_dim=self.embedding_dim
        )
        
        self.optimizer = optim.Adam(self.model.parameters(), lr=self.learning_rate)
        
        print(f"   Input Size: {self.vocab_size}")
        print(f"   Hidden Size: {self.hidden_size}")
        print(f"   Layers: Embedding -> LSTM -> Linear")

    # ================================================
    # STEP 5: TRAINING
    # ================================================
    def train(self):
        """
        Train the model
        """
        print("\n" + "="*50)
        print("Step 5: TRAINING LSTM")
        print("="*50)
        
        self.model.train()
        
        for epoch in range(self.epochs):
            self.optimizer.zero_grad()
            
            # Forward pass
            output = self.model(self.X_train)
            loss = self.criterion(output, self.y_train)
            
            # Backward pass and optimize
            loss.backward()
            self.optimizer.step()
            
            self.train_loss = loss.item()
            
            if (epoch+1) % 2 == 0:
                print(f"   Epoch [{epoch+1}/{self.epochs}], Loss: {loss.item():.4f}")
                
        self.is_fitted = True
        
        # Calculate training accuracy
        with torch.no_grad():
            self.model.eval()
            output = self.model(self.X_train)
            _, predicted = torch.max(output.data, 1)
            correct = (predicted == self.y_train).sum().item()
            self.train_accuracy = correct / len(self.y_train)
            
        print(f"   Final Training Loss: {self.train_loss:.4f}")
        print(f"   Training Accuracy: {self.train_accuracy:.4f}")

    # ================================================
    # STEP 6: EVALUATION
    # ================================================
    def evaluate(self):
        """
        Evaluate on test data
        """
        print("\n" + "="*50)
        print("Step 6: MODEL EVALUATION")
        print("="*50)
        
        self.model.eval()
        with torch.no_grad():
            output = self.model(self.X_test)
            _, predicted = torch.max(output.data, 1)
            correct = (predicted == self.y_test).sum().item()
            self.test_accuracy = correct / len(self.y_test)
            
        print(f"   Test Accuracy: {self.test_accuracy:.4f}")
        
        return {
            'loss': self.train_loss,
            'train_accuracy': self.train_accuracy,
            'test_accuracy': self.test_accuracy,
            'epochs': self.epochs
        }

    # ================================================
    # FULL PIPELINE
    # ================================================
    def run_pipeline(self, sequences):
        """
        Run complete ML pipeline
        """
        try:
            print("\n" + "="*50)
            print("LSTM ML PIPELINE")
            print("="*50)
            
            # 1. Load
            self.load_data(sequences)
            
            # 2. Preprocess
            X, y = self.preprocess_data(sequences)
            if len(X) == 0:
                return {'error': 'Not enough data for sequence length ' + str(self.sequence_length)}
            
            # 3. Split
            self.split_data(X, y)
            
            # 4. Build
            self.build_model()
            
            # 5. Train
            self.train()
            
            # 6. Evaluate
            metrics = self.evaluate()
            
            return metrics
            
        except Exception as e:
            return {'error': str(e)}

    # ================================================
    # ONLINE PREDICTION
    # ================================================
    def predict_next(self, current_sequence):
        """Predict next page based on recent history"""
        if not self.is_fitted or len(current_sequence) < self.sequence_length:
            return None
            
        try:
            # Prepare input
            seq = current_sequence[-self.sequence_length:]
            
            # Encode if possible
            if not all(p in self.classes_ for p in seq):
                return None
                
            encoded_seq = self.label_encoder.transform(seq)
            input_tensor = torch.tensor([encoded_seq], dtype=torch.long)
            
            self.model.eval()
            with torch.no_grad():
                output = self.model(input_tensor)
                probabilities = torch.softmax(output, dim=1)
                predicted_idx = torch.argmax(probabilities, dim=1).item()
                predicted_page = self.label_encoder.inverse_transform([predicted_idx])[0]
                
            return predicted_page
        except Exception:
            return None

    def access_page(self, process_id, page_number):
        """Simulate page access with page replacement"""
        page_key = int(page_number)
        self.current_time += 1
        
        # Check if we correctly predicted this access
        if self.last_prediction is not None:
             self.total_predictions += 1
             if self.last_prediction == page_key:
                 self.correct_predictions += 1
        
        # Update history
        self.history.append(page_key)
        
        # Make new prediction
        self.last_prediction = self.predict_next(self.history)
        
        # Handle hits/faults
        if page_key in self.frames:
            self.page_hits += 1
            frame_idx = self.frames.index(page_key)
            self.frame_metadata[frame_idx]['last_access'] = self.current_time
            self.frame_metadata[frame_idx]['access_count'] += 1
            return {
                'hit': True, 
                'pageFault': False,
                'replaced': None,
                'frames': list(self.frames),
                'prediction': self.last_prediction
            }
            
        self.page_faults += 1
        replaced_page = None
        target_frame = -1
        
        if None in self.frames:
             target_frame = self.frames.index(None)
        else:
             # FIFO/LRU Hybrid Fallback since LSTM predicts NEXT access, not VICTIM directly
             # We rely on LRU logic but could enhance with "don't evict if predicted next"
             lru_frame = min(range(self.frame_count), key=lambda i: self.frame_metadata[i]['last_access'])
             target_frame = lru_frame
             replaced_page = self.frames[target_frame]
             
        self.frames[target_frame] = page_key
        self.frame_metadata[target_frame] = {
            'page': page_key, 'load_time': self.current_time,
            'last_access': self.current_time, 'access_count': 1
        }
            
        return {
            'hit': False,
            'pageFault': True,
            'replaced': replaced_page,
            'frames': list(self.frames),
            'prediction': self.last_prediction
        }

    def get_stats(self):
        """Return simulation statistics"""
        total = self.page_faults + self.page_hits
        return {
            'page_faults': self.page_faults,
            'page_hits': self.page_hits,
            'hit_ratio': float(self.page_hits / total) if total > 0 else 0.0,
            'prediction_accuracy': float(self.correct_predictions / self.total_predictions * 100) if self.total_predictions > 0 else 0.0
        }

    def get_model_stats(self):
        return {
            'model_type': 'LSTM (PyTorch)',
            'is_fitted': self.is_fitted,
            'test_accuracy': float(self.test_accuracy) if self.test_accuracy else 0.0,
            'train_accuracy': float(self.train_accuracy) if self.train_accuracy else 0.0,
            'hidden_size': self.hidden_size,
            'prediction_accuracy': float(self.correct_predictions / self.total_predictions * 100) if self.total_predictions > 0 else 0.0
        }
