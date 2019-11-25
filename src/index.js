const Alexa = require('ask-sdk-core');
const ddbAdapter = require('ask-sdk-dynamodb-persistence-adapter');
const moment = require('moment');
const provider = require('./provider');
const utils = require('./utils');

const SKILL_TITLE = "Estado Carnet DGT";

async function makeStatusResponse(handlerInput, attributes) {
  const birthDateMoment = moment(attributes.birthDate);

  try {
    const lastState = await provider.accessLastStatus({
      "numDni": attributes.dniNumber,
      "diaNac": birthDateMoment.date(),
      "mesNac": birthDateMoment.month() + 1,
      "anoNac": birthDateMoment.year()
    });

    const onlyText = `¡Hola de nuevo! El último estado es: "${lastState}"`;
    const speechText = '¡Hola de nuevo! Vamos a ver cual es el estado de tu carnet ' +
      '<audio src="soundbank://soundlibrary/computers/beeps_tones/beeps_tones_11"/> ' +
      `El último estado es: "${lastState}"`;

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard(SKILL_TITLE, onlyText)
      .withShouldEndSession(true)
      .getResponse();
  } catch (e) {
    const speechText = 'Parece ser que la página de la DGT no funciona bien, inténtalo de nuevo más tarde.';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard(SKILL_TITLE, speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },

  async handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const attributes = await attributesManager.getPersistentAttributes() || {};

    if (attributes.dniNumber && attributes.birthDate) {
      // Does everything for us
      return makeStatusResponse(handlerInput, attributes);
    } else {
      const speechText = 'Bienvenido a Estado de Carnet DGT, para empezar necesito que me digas tu DNI y tu fecha de nacimiento. ' +
        'Estos datos se almacenan temporalmente, hasta que decidas eliminarlos de nuestra base de datos. ' +
        'Para empezar di "registra mis datos" o si quieres saber mas, di "ayuda"';

      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard(SKILL_TITLE, speechText)
        .getResponse();
    }
  }
};

const RegisterUserDataIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'RegisterUserDataIntent';
  },

  async handle(handlerInput) {
    const { attributesManager, requestEnvelope } = handlerInput;
    const attributes = await attributesManager.getPersistentAttributes() || {};
    const intent = requestEnvelope.request.intent;

    if (attributes.dniNumber && attributes.birthDate) {
      const speechText = 'Parece que ya estás en nuestra base de datos, si quieres eliminar tus datos di "elimina mis datos"';

      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard(SKILL_TITLE, speechText)
        .getResponse()
    }

    if (requestEnvelope.request.dialogState !== 'COMPLETED') {
      return handlerInput.responseBuilder
        .addDelegateDirective()
        .getResponse();
    }

    const dniNumberSlot = intent.slots["dniNumber"].value;
    const birthDateSlot = intent.slots["birthDate"].value;

    if (!utils.checkDniNumber(dniNumberSlot)) {
      const speechText =
        'El dni que me has dado no parece ser valido. ' +
        'Por favor, dime un DNI valido.';

      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .addElicitSlotDirective('dniNumber')
        .getResponse();
    }

    if (!utils.checkBirthDay(birthDateSlot)) {
      const speechText = 'La fecha de nacimiento que me has dado no parece ser valida. ' +
        'Por favor, dime cuando naciste.';

      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .addElicitSlotDirective('birthDate')
        .getResponse();
    }

    attributes.dniNumber = dniNumberSlot.toUpperCase();
    attributes.birthDate = birthDateSlot;

    attributesManager.setPersistentAttributes(attributes);
    await attributesManager.savePersistentAttributes();

    const speechText = 'Has registrado tus datos correctamente. ' +
      'Ahora puedes saber el estado de tu carnet diciendo "consulta el estado de mi carnet"';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard(SKILL_TITLE, speechText)
      .getResponse();
  }
};

const StatusQueryIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'StatusQueryIntent';
  },

  async handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const attributes = await attributesManager.getPersistentAttributes() || {};

    if (attributes.dniNumber && attributes.birthDate) {
      // Does everything for us
      return makeStatusResponse(handlerInput, attributes);
    } else {
      const speechText = 'Parece que todavía no estás en nuestra base de datos, dí "registra mis datos" para empezar';

      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard(SKILL_TITLE, speechText)
        .getResponse();
    }
  }
};

const ClearUserDataIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "IntentRequest"
      && handlerInput.requestEnvelope.request.intent.name === "ClearUserDataIntent";
  },

  async handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const attributes = await attributesManager.getPersistentAttributes() || {};

    if (attributes.dniNumber && attributes.birthDate) {
      // try deletePersistentAttributes()
      attributesManager.setPersistentAttributes({});
      await attributesManager.savePersistentAttributes();

      const onlyText = 'Hemos eliminado todos los datos que guardábamos de tí. ¡Disfruta de tu carnet!';
      const speechText = onlyText + '<audio src="soundbank://soundlibrary/vehicles/cars/cars_07"/>';

      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard(SKILL_TITLE, onlyText)
        .withShouldEndSession(true)
        .getResponse();
    } else {
      const speechText = 'Parece que no estás en nuestra base de datos, no tenemos nada que eliminar';

      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard(SKILL_TITLE, speechText)
        .withShouldEndSession(true)
        .getResponse();
    }
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'Esta skill te permite consultar el estado de tu carnet de conducir definitivo. ' +
      'Para consultar el estado de tu carnet, necesitamos tu DNI y tu fecha de nacimiento. ' +
      'Esos datos se guardan en nuestra base de datos para las próximas veces que lo consultes. ' +
      'Y obviamente, se envían a la pagina web de la DGT que es la que nos da el estado de tu carnet. ' +
      'Una vez estés registrado, puedes consultar el estado de tu carnet diciendo "consulta el estado". ' +
      'Para registrar tus datos di "registra mis datos". ' +
      'Para eliminar tus datos di "elimina mis datos". ' +
      '¿Que quieres hacer ahora?';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard(SKILL_TITLE, speechText)
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const speechText = '¡Hasta luego!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard(SKILL_TITLE, speechText)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    //any cleanup logic goes here
    console.log(`Session ended: ${handlerInput}`);
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    console.log(`Error stack: ${error.stack}`);

    const speechText = 'Ha ocurrido un error, por favor inténtalo otra vez';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

function getPersistenceAdapter(tableName) {
  return new ddbAdapter.DynamoDbPersistenceAdapter({
    tableName: tableName,
    createTable: true,
  });
}

let skill;

exports.handler = async function (event, context) {
  console.log(`SKILL REQUEST ${JSON.stringify(event)}`);

  if (!skill) {
    skill = Alexa.SkillBuilders.custom()
      .withPersistenceAdapter(
        getPersistenceAdapter('alexa-dgtstatus'))
      .addRequestHandlers(
        LaunchRequestHandler,
        StatusQueryIntentHandler,
        ClearUserDataIntentHandler,
        RegisterUserDataIntentHandler,

        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler)
      .addErrorHandlers(ErrorHandler)
      .create();
  }

  const response = await skill.invoke(event, context);
  console.log(`SKILL RESPONSE ${JSON.stringify(response)}`);

  return response;
};