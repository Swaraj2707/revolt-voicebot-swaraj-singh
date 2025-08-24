import VoiceChatInterface from './components/VoiceChatInterface';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Revolt Motors Voice Assistant <br/> by Swaraj Singh</h1>
        <p>Powered by Gemini Live API</p>
      </header>
      <main>
        <VoiceChatInterface />
      </main>
    </div>
  );
}

export default App;
