/*
 * Business data: the only JavaScript to edit when re-skinning for another business (together with
 * the copy in index.html and the :root token block in styles.css). Nothing in js/ hard-codes any
 * of these values.
 *
 * This is the monolith's STOREFRONT_CONFIG with two changes: `mount` is gone (the menu now renders
 * wherever <menu-catalog> sits), and `theme` moved to the CSS tokens so colours have one home.
 * Each product carries its id, name, category, description, price, image and removable ingredients.
 * Prices are read from here at render time and never stored, so catalogue edits always apply.
 */
export default {
  business: 'Date El Gusto',
  whatsapp: '+502 4539 3659', // any format; reduced to digits for the wa.me link
  locale: 'es-GT',
  currency: 'GTQ',
  storageKey: 'date-el-gusto:storefront', // localStorage namespace for the cart and the customer profile
  maxQty: 20, // per cart line
  orderId: { prefix: 'DG', randomLength: 5 }, // e.g. DG-261027-7KQ4M

  // Optional map pin for the delivery spot. Leaflet + OpenStreetMap tiles load only when the picker first opens.
  location: { enabled: true, defaultCenter: [14.523, -90.759], zoom: 16 },

  // UI copy. Keys prefixed msg* go into the WhatsApp message verbatim.
  text: {
    noticeTitle: 'Pedidos por WhatsApp.',
    noticeBody: 'Elige y personaliza tus platillos aquí; al finalizar se abre WhatsApp con tu pedido listo. Pago y entrega se coordinan en el chat.',
    orderNow: 'Ordenar ahora',
    ingredients: 'Ingredientes',
    ingredientsHint: 'Desmarca lo que no quieras.',
    quantity: 'Cantidad', decrease: 'Quitar uno', increase: 'Agregar uno',
    add: 'Agregar', close: 'Cerrar',
    cartTitle: 'Tu pedido', viewCart: 'Ver pedido', empty: 'Tu pedido está vacío. Agrega platillos del menú.',
    remove: 'Eliminar', without: 'sin', total: 'Total',
    edit: 'Cambiar', save: 'Guardar', updated: 'Actualizado',
    removedLabel: 'Sin', allIngredients: 'Con todos los ingredientes',
    name: 'Nombre', address: 'Dirección de entrega', addressHint: 'Zona, calle, número y referencias', notes: 'Notas (opcional)',
    submit: 'Pedir por WhatsApp', keepShopping: 'Seguir Comprando',
    submitHint: 'Se abrirá WhatsApp con tu pedido listo para enviar.',
    opened: 'Abrimos WhatsApp. Envía el mensaje para confirmar tu pedido.',
    added: 'Agregado',
    itemsLabel: n => n === 1 ? '1 platillo' : n + ' platillos',
    msgOrder: 'Pedido',
    msgGreeting: 'Hola Date El Gusto, quiero hacer este pedido:',
    msgName: 'Nombre', msgAddress: 'Dirección', msgNotes: 'Notas', msgLocation: 'Ubicación',
    locShare: 'Compartir ubicación (opcional)',
    locTitle: 'Ubicación de entrega',
    locLocating: 'Buscando tu ubicación…',
    locFound: 'Arrastra el pin o toca el mapa para marcar el punto exacto de entrega.',
    locDenied: 'No pudimos obtener tu ubicación. Mueve el pin o toca el mapa para marcar tu punto de entrega.',
    locMapFailed: 'No se pudo cargar el mapa. Puedes pedir sin ubicación, tu dirección es suficiente.',
    locConfirm: 'Confirmar ubicación',
    locAdded: 'Ubicación agregada', locView: 'Mapa', locChange: 'Cambiar', locRemove: 'Quitar',
    locPin: 'Punto de entrega',
    // installable app (js/components/pwa.js); offline.html repeats the offline copy because it cannot load this file
    install: 'Instalar App',
    iosTitle: 'Agregar a Inicio',
    iosIntro: 'Instala Date Gusto en tu pantalla de inicio para pedir más rápido.',
    iosShare: 'Toca el botón Compartir {share} en Safari (si no lo ves, está en el menú •••).',
    iosAdd: 'Elige «Agregar a inicio» y luego toca «Agregar».',
    offlineTitle: 'Sin conexión a internet',
    offlineBody: 'Date Gusto necesita una conexión activa a internet y no se puede usar sin conexión: aquí ves el menú y envías tu pedido por WhatsApp.',
    offlineAuto: 'La página se recupera sola cuando vuelva la conexión.',
    retry: 'Reintentar',
    // <reserve-form> demo (the section is hidden in index.html for now)
    reserveInvalid: 'Elige una fecha válida.',
    reserveFound: (people, date, time) => `¡Hay mesa! ${people} el ${date} a las ${time}. (Demo)`
  },

  products: [
    { id: 'tostadas', category: 'Entradas', name: 'Tostadas chapinas', price: 35,
      description: 'Tres tostadas crujientes con guacamol, frijol volteado y salsa de tomate.',
      image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Guacamol', 'Frijol volteado', 'Salsa de tomate', 'Cebolla', 'Queso seco', 'Perejil'] },
    { id: 'ceviche', category: 'Entradas', name: 'Ceviche de camarón', price: 70,
      description: 'Camarón marinado en limón con tomate, cebolla, cilantro y aguacate.',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Tomate', 'Cebolla', 'Cilantro', 'Aguacate', 'Chile'] },
    { id: 'pepian', category: 'Platos fuertes', name: 'Pepián de pollo', price: 85,
      description: 'Recado tostado de semillas y chiles con pollo, güisquil y papa. Con arroz.',
      image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Güisquil', 'Papa', 'Ejotes', 'Arroz', 'Tortillas'] },
    { id: 'jocon', category: 'Platos fuertes', name: 'Jocón con arroz', price: 80,
      description: 'Pollo en recado verde de miltomate y cilantro, servido con arroz.',
      image: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Cebolla', 'Cilantro', 'Arroz', 'Tortillas'] },
    { id: 'churrasco', category: 'Platos fuertes', name: 'Churrasco chapín', price: 110,
      description: 'Puyazo a las brasas con chirmol, frijoles, guacamol y cebollín asado.',
      image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Chirmol', 'Frijoles', 'Guacamol', 'Cebollín', 'Chorizo', 'Tortillas'] },
    { id: 'costillas', category: 'Platos fuertes', name: 'Costillas BBQ', price: 120,
      description: 'Costillas de cerdo glaseadas, con papas y ensalada de la casa.',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Salsa BBQ', 'Papas', 'Ensalada', 'Cebolla morada'] },
    { id: 'rellenitos', category: 'Postres', name: 'Rellenitos de plátano', price: 30,
      description: 'Plátano maduro relleno de frijol dulce con chocolate y canela.',
      image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Azúcar', 'Canela'] },
    { id: 'pastel', category: 'Postres', name: 'Pastel de frutos rojos', price: 35,
      description: 'Bizcocho suave con crema y frambuesas frescas.',
      image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Crema', 'Frambuesas'] },
    { id: 'horchata', category: 'Bebidas', name: 'Horchata', price: 18,
      description: 'Bebida fría de arroz con canela, hecha en casa.',
      image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&h=450&q=70',
      ingredients: ['Hielo', 'Canela'] }
  ]
};
