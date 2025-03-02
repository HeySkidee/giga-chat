import React, { useEffect, useState, useRef } from 'react'
import supabase from './utils/supabase'

const App = () => {
  const [session, setSession] = useState(null);

  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [usersOnline, setUsersOnline] = useState([])

  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  const chatContainerRef = useRef(null)

  useEffect(() => {
    async function fetchSession() {
      const { data: { session } } = await supabase.auth.getSession(); // checking for session on client side
      setSession(session);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // SINGIN FUNCTION
  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
  };

  // SIGNOUT FUNCTION
  async function signOut() {
    const { error } = supabase.auth.signOut();
  }

  // supabase websocket
  useEffect(() => {
    if (!session?.user) {
      setUsersOnline([])
    }

    const roomOne = supabase.channel('room_one', {
      config: {
        presence: {
          key: session?.user?.id,
        },
      },
    })

    roomOne.on("broadcast", { event: "message" }, (payload) => {
      setMessages(prevMessages => [...prevMessages, payload]);
    })

    // track user presence 
    roomOne.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await roomOne.track({
          id: session?.user?.id,
        });
      }
    })

    // set number of users online
    roomOne.on("presence", { event: 'sync' }, () => {
      const state = roomOne.presenceState();
      setUsersOnline(Object.keys(state))
    })

    return () => {
      roomOne.unsubscribe();
    }

  }, [session])

  // send message handler
  async function sendMessage(e) {
    e.preventDefault();

    supabase.channel("room_one").send({
      type: "broadcast",
      event: "message",
      payload: {
        message: newMessage,
        email: session?.user?.email,
        user: session?.user?.user_metadata?.name,
        avatar: session?.user?.user_metadata?.avatar_url,
        timestamp: new Date().toISOString(),
      },
    })
    setNewMessage("");
  }

  // TOGGLE MENU
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function showMenu() {
    setMenu(!menu)
  }

  // Scroll to bottom when new chat comes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // if session doesn't exist, ask for login
  if (!session) {
    return (
      <div className='w-full h-screen flex flex-col justify-center items-center -mt-15'>
        <h1 className='text-6xl font-bold mb-10'>Giga Chat 🗿</h1>
        <button onClick={signIn} className='px-4 py-2 rounded cursor-pointer bg-blue-600 hover:bg-blue-700'>Sign in with Google to start chatting!</button>
      </div>
    )
  }

  // if session exists, show the chat
  return (
    <div className='w-full h-screen flex flex-col justify-center items-center p-4'>
      {/* <h1 className='mb-4 text-2xl font-bold text-green-400'>Giga Chat</h1> */}
      {/* <h1 className='text-6xl font-bold mb-10'>Giga Chat 🗿</h1> */}

      <div className='w-full max-w-6xl min-h-[600px] border border-gray-500 rounded-lg'>

        {/* HEADER */}
        <div className='h-20 border-b border-gray-500 flex items-center justify-between px-4'>
          <div>
            <p className='break-words'>Welcome {session?.user?.user_metadata?.name} 🗿</p>
            <div className='flex items-center text-gray-400'>{usersOnline.length} Users online <div className='w-2 h-2 bg-green-500 rounded-full ml-1.5 mt-[4.78px] animate-pulse'></div></div>
          </div>
          <div ref={menuRef} className='relative'>
            <div onClick={showMenu} className='w-10 h-10 cursor-pointer'>
              <img src={session?.user?.user_metadata?.avatar_url} alt="profile" className='rounded' />
            </div>
            <button
              onClick={signOut}
              className={`absolute right-0 ${menu ? 'opacity-100' : 'opacity-0 pointer-events-none'} z-10 mt-1 cursor-pointer rounded-md px-3 py-2 bg-red-600 transition-opacity duration-300 hover:bg-red-700`}
            >
              Signout
            </button>
          </div>
        </div>

        {/* MAIN CHAT */}
        <div ref={chatContainerRef} className='h-[500px] flex flex-col p-4 overflow-y-auto text-white'>
          {messages.map((msg, index) => (
            <div key={index} className={`w-full my-1.5 flex flex-col ${msg.payload.email === session?.user?.email ? "items-end" : "items-start"}`}>
              {/* Username display */}
              <span className="text-xs text-gray-400 mb-1 ml-11 mr-1">
                {msg.payload.email === session?.user?.email ? 'You' : msg.payload.user}
              </span>
              
              <div className={`w-full flex items-start ${msg.payload.email === session?.user?.email ? "justify-end" : "justify-start"}`}>
                {msg?.payload.email !== session?.user?.email &&
                  <img src={msg.payload.avatar} alt="pfp" className='w-9 h-9 rounded-full mr-2' />
                }

                <div className={`max-w-[70%] px-4 pb-2 pt-1.5 rounded-4xl break-words ${msg?.payload.email === session?.user?.email ? "bg-blue-600" : "bg-neutral-800"}`}>
                  <p>{msg.payload.message}</p>
                </div>

                {msg?.payload.email === session?.user?.email &&
                  <img src={msg.payload.avatar} alt="pfp" className='w-9 h-9 rounded-full ml-2' />
                }
              </div>
            </div>
          ))}
        </div>

        {/* INPUT FIELD */}
        <form onSubmit={sendMessage} className='flex p-4 border-t border-gray-500' >
          <input
            type="text"
            placeholder='Type a message...'

            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}

            className='border border-gray-500 rounded-lg p-2 w-full bg-[#46464640]'
          />
          <button className='px-4 py-1 rounded-md ml-4 bg-blue-600 hover:bg-blue-700 cursor-pointer'>Send</button>
        </form>

      </div>
    </div>
  )
}

export default App

// im going to give the best effort i've ever given in life.